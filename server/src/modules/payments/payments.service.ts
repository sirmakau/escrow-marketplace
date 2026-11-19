import { db, schema, withTx } from '../../db/client.js';
import { AppError, generateId, logger, maskPII } from '../../utils/helpers.js';
import { config } from '../../config/index.js';
import { getDaraja } from '../../integrations/mpesa/daraja.js';
import type { StkCallback } from '../../integrations/mpesa/daraja.js';
import { eq, and, isNull } from 'drizzle-orm';

/**
 * Initiate an STK Push for the payer to fund an order.
 * The payer's wallet must be sufficient only in mock mode; in live mode
 * M-Pesa checks the payer's mobile money balance directly.
 */
export async function initiateFunding(orderId: string, userId: string) {
  return withTx(async (tx) => {
    // Lock and validate order
    const [order] = await tx.select().from(schema.orders)
      .where(eq(schema.orders.id, orderId))
      .for('update')
      .limit(1);

    if (!order) throw new AppError('NOT_FOUND', 'Order not found', 404);
    if (order.payerId !== userId) {
      throw new AppError('FORBIDDEN', 'Only the payer can fund', 403);
    }

    if (order.state !== 'ACCEPTED') {
      throw new AppError('ORDER_STATE_INVALID', `Cannot fund in state ${order.state}`, 409);
    }

    const totalAmount = (order.priceCents ?? 0) + (order.calloutFeeCents ?? 0);
    if (totalAmount <= 0) throw new AppError('VALIDATION_ERROR', 'Invalid payment amount', 400);

    // Get payer's phone
    const [payer] = await tx.select().from(schema.users).where(eq(schema.users.id, userId)).limit(1);
    if (!payer) throw new AppError('NOT_FOUND', 'Payer not found', 404);

    // Call Daraja
    const daraja = getDaraja();
    const stkResponse = await daraja.stkPush({
      amount: totalAmount,
      phone: payer.phone,
      orderId,
      accountReference: orderId.slice(0, 12),
      transactionDesc: 'Escrow order funding',
    });

    // Record payment attempt
    const [payment] = await tx.insert(schema.mpesaPayments).values({
      orderId,
      userId,
      type: 'stk_push',
      direction: 'inflow',
      amountCents: totalAmount,
      checkoutRequestId: stkResponse.CheckoutRequestID,
      status: 'PENDING',
    }).returning();

    logger.info(
      { orderId, checkoutRequestId: stkResponse.CheckoutRequestID, amount: totalAmount },
      'STK Push initiated',
    );

    return { paymentId: payment.id, checkoutRequestId: stkResponse.CheckoutRequestID };
  });
}

export async function reconcileFunding(orderId: string, userId: string) {
  const [order] = await db.select()
    .from(schema.orders)
    .where(eq(schema.orders.id, orderId))
    .limit(1);

  if (!order) throw new AppError('NOT_FOUND', 'Order not found', 404);
  if (order.payerId !== userId) {
    throw new AppError('FORBIDDEN', 'Only the payer can reconcile funding', 403);
  }

  const [payment] = await db.select()
    .from(schema.mpesaPayments)
    .where(and(
      eq(schema.mpesaPayments.orderId, orderId),
      eq(schema.mpesaPayments.type, 'stk_push'),
      eq(schema.mpesaPayments.status, 'PENDING'),
    ))
    .orderBy(schema.mpesaPayments.createdAt)
    .limit(1);

  if (!payment?.checkoutRequestId) {
    return { reconciled: false, state: order.state };
  }

  const result = await getDaraja().stkQuery(payment.checkoutRequestId);
  if (result.ResultCode !== 0) {
    return { reconciled: false, state: order.state };
  }

  await handleStkCallback({
    ...result,
    MpesaReceiptNumber: payment.mpesaReceiptNumber ?? undefined,
  });

  const [freshOrder] = await db.select()
    .from(schema.orders)
    .where(eq(schema.orders.id, orderId))
    .limit(1);
  return { reconciled: freshOrder?.state === 'FUNDED', state: freshOrder?.state ?? order.state };
}

/**
 * Handle STK callback from Daraja.
 * Deduplicates on MpesaReceiptNumber and CheckoutRequestID.
 */
export async function handleStkCallback(callback: StkCallback) {
  const idempotencyKey = callback.MpesaReceiptNumber || callback.CheckoutRequestID;

  // Check if already processed
  const existing = await db.select()
    .from(schema.webhookEvents)
    .where(eq(schema.webhookEvents.idempotencyKey, idempotencyKey))
    .limit(1);

  if (existing.length > 0) {
    logger.info({ idempotencyKey }, 'Duplicate STK callback, skipping');
    return;
  }

  // Find the payment record
  const [payment] = await db.select()
    .from(schema.mpesaPayments)
    .where(eq(schema.mpesaPayments.checkoutRequestId, callback.CheckoutRequestID))
    .limit(1);

  if (!payment) {
    logger.warn({ checkoutRequestId: callback.CheckoutRequestID }, 'No matching payment for callback');
    // Still record the webhook
    await db.insert(schema.webhookEvents).values({
      source: 'mpesa',
      idempotencyKey,
      eventType: 'stk_callback_orphan',
      rawBody: callback as any,
      processedAt: new Date(),
      error: 'No matching payment',
    }).execute();
    return;
  }

  await withTx(async (tx) => {
    // Mark webhook as received
    await tx.insert(schema.webhookEvents).values({
      source: 'mpesa',
      idempotencyKey,
      orderId: payment.orderId,
      eventType: 'stk_callback',
      rawBody: callback as any,
      processedAt: new Date(),
    }).execute();

    // Update payment record
    const updateData: any = {
      mpesaReceiptNumber: callback.MpesaReceiptNumber,
      resultCode: callback.ResultCode,
      resultDesc: callback.ResultDesc,
      rawCallback: callback,
      status: callback.ResultCode === 0 ? 'SUCCESS' : 'FAILED',
      updatedAt: new Date(),
    };
    await tx.update(schema.mpesaPayments)
      .set(updateData)
      .where(eq(schema.mpesaPayments.id, payment.id))
      .execute();

    if (callback.ResultCode === 0) {
      // Success — move order to FUNDED and create ledger entries
      const [order] = await tx.select().from(schema.orders)
        .where(eq(schema.orders.id, payment.orderId))
        .for('update')
        .limit(1);

      if (order && order.state === 'ACCEPTED') {
        const totalAmount = payment.amountCents;

        // Double-entry: payer funds the platform float
        const txId = generateId();
        await tx.insert(schema.ledgerEntries).values([
          {
            transactionId: txId,
            orderId: payment.orderId,
            fromAccount: `user:${payment.userId}`,
            toAccount: 'mpesa_float',
            amountCents: totalAmount,
            reason: 'escrow_deposit',
            refType: 'mpesa_payment',
            refId: payment.id,
          },
        ]).execute();

        // Update order state
        await tx.update(schema.orders)
          .set({
            state: 'FUNDED',
            version: order.version + 1,
            paidAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(schema.orders.id, payment.orderId))
          .execute();

        // Schedule review deadline. timers.order_id is unique, so replace the
        // now-obsolete funding-window timer rather than adding a second row.
        const reviewDeadline = new Date(Date.now() + config.REVIEW_WINDOW_HOURS * 60 * 60 * 1000);
        await tx.delete(schema.timers)
          .where(eq(schema.timers.orderId, payment.orderId))
          .execute();
        await tx.insert(schema.timers).values({
          orderId: payment.orderId,
          timerType: 'REVIEW_WINDOW',
          fireAt: reviewDeadline,
          action: 'AUTO_RELEASE',
        }).execute();

        await tx.update(schema.orders)
          .set({ reviewDeadline })
          .where(eq(schema.orders.id, payment.orderId))
          .execute();

        // Audit
        await tx.insert(schema.auditLog).values({
          tableName: 'orders',
          recordId: payment.orderId,
          action: 'FUNDED',
          newValues: { state: 'FUNDED', paidAt: new Date(), amount: totalAmount },
          metadata: { mpesaReceipt: callback.MpesaReceiptNumber },
        }).execute();
      }
    }
  });
}

/**
 * Release funds to the payee after COMPLETED state.
 * Creates a withdrawal ledger entry and initiates B2C payout.
 * Double-entry: platform_float -> payee_wallet -> payee_bank/m-pesa
 */
export async function releasePayment(orderId: string, userId: string) {
  if (!config.isB2cEnabled) {
    throw new AppError('PAYMENT_NOT_CONFIGURED', 'B2C payouts are not configured', 503);
  }

  return withTx(async (tx) => {
    const [order] = await tx.select().from(schema.orders)
      .where(eq(schema.orders.id, orderId))
      .for('update')
      .limit(1);

    if (!order) throw new AppError('NOT_FOUND', 'Order not found', 404);

    // Payer releases a COMPLETED order; support/admin releases a DISPUTED one
    // after resolving it in the payee's favour.
    const [actor] = await tx.select({ role: schema.users.role })
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);
    const isStaff = actor?.role === 'admin' || actor?.role === 'support';

    if (order.state === 'COMPLETED') {
      if (order.payerId !== userId && !isStaff) {
        throw new AppError('FORBIDDEN', 'Only the payer can release this order', 403);
      }
    } else if (order.state === 'DISPUTED') {
      if (!isStaff) {
        throw new AppError('FORBIDDEN', 'Only support can release a disputed order', 403);
      }
    } else {
      throw new AppError('ORDER_STATE_INVALID', `Cannot release in state ${order.state}`, 409);
    }

    // Calculate amounts
    const totalPaid = (order.priceCents ?? 0) + (order.calloutFeeCents ?? 0);
    const feeCents = order.feeCents ?? Math.floor((order.priceCents ?? 0) * config.PLATFORM_FEE_PERCENT / 100);
    const payeeAmount = totalPaid - feeCents;

    if (payeeAmount <= 0) {
      throw new AppError('INSUFFICIENT_FUNDS', 'Nothing to release after fees', 400);
    }

    const txId = generateId();

    // Double-entry: float -> platform revenue (fee)
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

    // Update order
    await tx.update(schema.orders)
      .set({
        state: 'RELEASED',
        version: order.version + 1,
        releasedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.orders.id, orderId))
      .execute();

    // Initiate B2C payout
    const [payee] = await tx.select().from(schema.users).where(eq(schema.users.id, order.payeeId)).limit(1);
    if (payee) {
      try {
        const daraja = getDaraja();
        const b2cResult = await daraja.b2c({
          amount: payeeAmount,
          phone: payee.phone,
          receiverName: payee.displayName,
          remarks: `Payout for order ${orderId.slice(0, 8)}`,
        });

        await tx.insert(schema.mpesaPayments).values({
          orderId,
          userId: order.payeeId,
          type: 'b2c',
          direction: 'outflow',
          amountCents: payeeAmount,
          conversationId: b2cResult.ConversationID,
          originatorConversationId: b2cResult.OriginatorConversationID,
          status: 'PENDING',
        }).execute();
      } catch (err: any) {
        logger.error({ orderId, err: err.message }, 'B2C payout initiation failed');
        // Funds stay in float — retry via worker
      }
    }

    await tx.insert(schema.auditLog).values({
      tableName: 'orders',
      recordId: orderId,
      action: 'RELEASED',
      newValues: { state: 'RELEASED', payeeAmount, feeCents },
    }).execute();

    return { payeeAmount, feeCents };
  });
}

/**
 * Refund the payer (dispute resolution). Funds flow back to payer's M-Pesa.
 */
export async function refundPayer(orderId: string, resolvedBy: string) {
  if (!config.isB2cEnabled) {
    throw new AppError('PAYMENT_NOT_CONFIGURED', 'B2C payouts are not configured', 503);
  }

  return withTx(async (tx) => {
    const [order] = await tx.select().from(schema.orders)
      .where(eq(schema.orders.id, orderId))
      .for('update')
      .limit(1);

    if (!order || order.state !== 'DISPUTED') {
      throw new AppError('ORDER_STATE_INVALID', 'Order must be DISPUTED to refund', 409);
    }

    const totalPaid = (order.priceCents ?? 0) + (order.calloutFeeCents ?? 0);
    const txId = generateId();

    // Reverse the float
    await tx.insert(schema.ledgerEntries).values({
      transactionId: txId,
      orderId,
      fromAccount: 'mpesa_float',
      toAccount: `user:${order.payerId}`,
      amountCents: totalPaid,
      reason: 'refund',
    }).execute();

    await tx.update(schema.orders)
      .set({ state: 'REFUNDED', version: order.version + 1, releasedAt: new Date(), updatedAt: new Date() })
      .where(eq(schema.orders.id, orderId))
      .execute();

    // Initiate B2C back to payer
    const [payer] = await tx.select().from(schema.users).where(eq(schema.users.id, order.payerId)).limit(1);
    if (payer) {
      try {
        const daraja = getDaraja();
        await daraja.b2c({
          amount: totalPaid,
          phone: payer.phone,
          receiverName: payer.displayName,
          remarks: `Refund for order ${orderId.slice(0, 8)}`,
        });
      } catch (err: any) {
        logger.error({ orderId, err: err.message }, 'Refund B2C failed');
      }
    }

    return { refundedAmount: totalPaid };
  });
}