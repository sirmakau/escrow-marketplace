/**
 * Worker process — runs in a loop polling the timers table.
 *
 * Order lifecycle automation:
 *  - Cancel unfunded orders after the funding window expires.
 *  - Auto-release when the review window ends with no dispute.
 *  - Retry failed B2C payouts.
 *  - Reconcile pending STK payments via STK Query.
 *
 * Every iteration uses FOR UPDATE SKIP LOCKED to avoid competing workers.
 */

import { db, schema, withTx } from '../db/client.js';
import { config } from '../config/index.js';
import { getDaraja } from '../integrations/mpesa/daraja.js';
import { eq, and, isNull, lt, lte, sql } from 'drizzle-orm';
import { AppError, generateId } from '../utils/helpers.js';
import pino from 'pino';

const logger = pino({
  level: config.LOG_LEVEL,
  name: 'worker',
  ...(config.NODE_ENV === 'development' && {
    transport: { target: 'pino/file', options: { destination: 1 } },
  }),
});

const POLL_INTERVAL_MS = 5_000;

async function processTimers() {
  // Fetch due timers that haven't fired
  const dueTimers = await db.select()
    .from(schema.timers)
    .where(and(
      lte(schema.timers.fireAt, new Date()),
      isNull(schema.timers.firedAt),
    ))
    .limit(10)
    .for('update', { skipLocked: true });

  for (const timer of dueTimers) {
    try {
      await processTimer(timer);
      // Mark as fired
      await db.update(schema.timers)
        .set({ firedAt: new Date() })
        .where(eq(schema.timers.id, timer.id))
        .execute();
    } catch (err: any) {
      logger.error({ timerId: timer.id, orderId: timer.orderId, action: timer.action, err: err.message }, 'Timer failed');
    }
  }
}

async function processTimer(timer: typeof schema.timers.$inferSelect) {
  switch (timer.action) {
    case 'CANCEL_UNFUNDED':
      await cancelUnfundedOrder(timer.orderId);
      break;
    case 'AUTO_RELEASE':
      await autoRelease(timer.orderId);
      break;
    case 'PAYOUT_RETRY':
      await retryPayout(timer.orderId);
      break;
    case 'NO_SHOW':
      await flagNoShow(timer.orderId);
      break;
    default:
      logger.warn({ action: timer.action }, 'Unknown timer action');
  }
}

async function cancelUnfundedOrder(orderId: string) {
  await withTx(async (tx) => {
    const [order] = await tx.select().from(schema.orders)
      .where(eq(schema.orders.id, orderId))
      .for('update')
      .limit(1);

    if (!order || order.state !== 'ACCEPTED') {
      logger.info({ orderId, state: order?.state }, 'Order not in ACCEPTED, skipping cancel');
      return;
    }

    await tx.update(schema.orders)
      .set({ state: 'CANCELLED', version: order.version + 1, updatedAt: new Date() })
      .where(eq(schema.orders.id, orderId))
      .execute();

    await tx.insert(schema.auditLog).values({
      tableName: 'orders',
      recordId: orderId,
      action: 'AUTO_CANCEL_UNFUNDED',
      actorId: '00000000-0000-0000-0000-000000000000',
      newValues: { state: 'CANCELLED' },
    }).execute();

    logger.info({ orderId }, 'Order cancelled due to funding timeout');
  });
}

async function autoRelease(orderId: string) {
  await withTx(async (tx) => {
    const [order] = await tx.select().from(schema.orders)
      .where(eq(schema.orders.id, orderId))
      .for('update')
      .limit(1);

    if (!order || order.state !== 'COMPLETED') {
      logger.info({ orderId, state: order?.state }, 'Order not in COMPLETED, skipping auto-release');
      return;
    }

    // Check no dispute exists
    const [dispute] = await tx.select()
      .from(schema.disputes)
      .where(and(
        eq(schema.disputes.orderId, orderId),
        eq(schema.disputes.status, 'OPEN'),
      ))
      .limit(1);

    if (dispute) {
      logger.info({ orderId }, 'Dispute exists, skipping auto-release');
      return;
    }

    // Perform release (same logic as paymentsService.releasePayment)
    const feeCents = order.feeCents ?? Math.floor((order.priceCents ?? 0) * config.PLATFORM_FEE_PERCENT / 100);
    const totalPaid = (order.priceCents ?? 0) + (order.calloutFeeCents ?? 0);
    const payeeAmount = totalPaid - feeCents;

    const txId = generateId();
    await tx.insert(schema.ledgerEntries).values([
      {
        transactionId: txId,
        orderId,
        fromAccount: 'mpesa_float',
        toAccount: 'platform_revenue',
        amountCents: feeCents,
        reason: 'platform_fee',
      },
      {
        transactionId: txId,
        orderId,
        fromAccount: 'mpesa_float',
        toAccount: `user:${order.payeeId}`,
        amountCents: payeeAmount,
        reason: 'payout',
      },
    ]).execute();

    await tx.update(schema.orders)
      .set({ state: 'RELEASED', version: order.version + 1, releasedAt: new Date(), updatedAt: new Date() })
      .where(eq(schema.orders.id, orderId))
      .execute();

    await tx.insert(schema.auditLog).values({
      tableName: 'orders',
      recordId: orderId,
      action: 'AUTO_RELEASE',
      actorId: '00000000-0000-0000-0000-000000000000',
      newValues: { state: 'RELEASED', payeeAmount, feeCents },
    }).execute();

    logger.info({ orderId, payeeAmount }, 'Order auto-released');
  });
}

async function retryPayout(orderId: string) {
  logger.info({ orderId }, 'Retrying payout (stub)');
  // TODO: Find failed B2C payments for this order and retry
}

async function flagNoShow(orderId: string) {
  logger.info({ orderId }, 'No-show flagged (stub)');
  // TODO: Transition to a no-show state if both parties haven't checked in
}

async function reconcilePendingPayments() {
  // Find STK pushes that are PENDING and older than 5 minutes
  const cutoff = new Date(Date.now() - 5 * 60 * 1000);
  const pendingPayments = await db.select()
    .from(schema.mpesaPayments)
    .where(and(
      eq(schema.mpesaPayments.status, 'PENDING'),
      eq(schema.mpesaPayments.type, 'stk_push'),
      lt(schema.mpesaPayments.createdAt, cutoff),
    ))
    .limit(5);

  for (const payment of pendingPayments) {
    try {
      if (!payment.checkoutRequestId) continue;
      const daraja = getDaraja();
      const result = await daraja.stkQuery(payment.checkoutRequestId);

      if (result.ResultCode === 0) {
        // Payment succeeded but we missed the callback — process it
        const { handleStkCallback } = await import('../modules/payments/payments.service.js');
        await handleStkCallback(result);
        logger.info({ paymentId: payment.id, orderId: payment.orderId }, 'Reconciled pending STK payment');
      }
    } catch (err: any) {
      logger.error({ paymentId: payment.id, err: err.message }, 'Failed to reconcile payment');
    }
  }
}

async function mainLoop() {
  logger.info('Worker started — polling every %d ms', POLL_INTERVAL_MS);

  while (true) {
    try {
      await processTimers();
      await reconcilePendingPayments();
    } catch (err: any) {
      logger.error({ err: err.message }, 'Worker loop error');
    }
    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}

mainLoop().catch((err) => {
  logger.fatal({ err }, 'Worker crashed');
  process.exit(1);
});