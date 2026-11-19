/**
 * ORDER STATE MACHINE
 *
 * Transitions and guards. The matrix below defines who can do what and
 * what the preconditions are. Anything not listed returns 409.
 *
 * ┌──────────────┬────────────┬──────────────────────────────┐
 * │ Current      │ Actor      │ Next state (condition)       │
 * ├──────────────┼────────────┼──────────────────────────────┤
 * │ DRAFT        │ payee      │ PROPOSED                     │
 * │ PROPOSED     │ payer      │ ACCEPTED                     │
 * │ ACCEPTED     │ (system)   │ FUNDED (after payment recvd) │
 * │ FUNDED       │ payer      │ IN_PROGRESS (mutual checkin) │
 * │ FUNDED       │ payee      │ IN_PROGRESS (digital deliv)  │
 * │ IN_PROGRESS  │ payee      │ DELIVERED                    │
 * │ DELIVERED    │ payer      │ COMPLETED                    │
 * │ COMPLETED    │ (system)   │ RELEASED (timer or approval) │
 * │ *            │ payer      │ DISPUTED                     │
 * │ *            │ payee      │ DISPUTED                     │
 * │ DRAFT        │ payee      │ CANCELLED                    │
 * │ PROPOSED     │ payer      │ CANCELLED                    │
 * │ ACCEPTED     │ payer      │ CANCELLED (before fund)      │
 * │ DISPUTED     │ support    │ REFUNDED                     │
 * │ DISPUTED     │ support    │ RELEASED                     │
 * └──────────────┴────────────┴──────────────────────────────┘
 */

import { db, schema, withTx } from '../../db/client.js';
import { AppError, generateId, logger } from '../../utils/helpers.js';
import { eq, and, sql } from 'drizzle-orm';
import { config } from '../../config/index.js';
import crypto from 'node:crypto';

type OrderState = string;
type ActorType = 'payer' | 'payee' | 'system' | 'admin' | 'support';

interface Transition {
  from: OrderState[];
  actor: ActorType;
  to: OrderState;
  /** Additional guard function */
  guard?: (order: any, actorId: string, tx: any) => Promise<void>;
}

export const TRANSITIONS: Transition[] = [
  { from: ['DRAFT'], actor: 'payee', to: 'PROPOSED' },
  { from: ['PROPOSED'], actor: 'payer', to: 'ACCEPTED' },
  // FUNDED is set by the payment callback, actor = system
  { from: ['ACCEPTED'], actor: 'system', to: 'FUNDED' },
  { from: ['FUNDED'], actor: 'payer', to: 'IN_PROGRESS' },  // in-person check-in by payer
  { from: ['FUNDED'], actor: 'payee', to: 'IN_PROGRESS' },  // digital delivery
  { from: ['IN_PROGRESS'], actor: 'payee', to: 'DELIVERED' },
  { from: ['DELIVERED'], actor: 'payer', to: 'COMPLETED' },
  { from: ['COMPLETED'], actor: 'system', to: 'RELEASED' },
  // Cancellations
  { from: ['DRAFT'], actor: 'payee', to: 'CANCELLED' },
  { from: ['PROPOSED', 'ACCEPTED'], actor: 'payer', to: 'CANCELLED' },
  // Dispute — can be opened by either party at any funded state
  { from: ['FUNDED', 'IN_PROGRESS', 'DELIVERED', 'COMPLETED'], actor: 'payer', to: 'DISPUTED' },
  { from: ['FUNDED', 'IN_PROGRESS', 'DELIVERED', 'COMPLETED'], actor: 'payee', to: 'DISPUTED' },
  // Resolution
  { from: ['DISPUTED'], actor: 'support', to: 'REFUNDED' },
  { from: ['DISPUTED'], actor: 'support', to: 'RELEASED' },
];

function getActorType(order: any, userId: string): ActorType | null {
  if (!userId) return null;
  if (order.payerId === userId) return 'payer';
  if (order.payeeId === userId) return 'payee';
  return null;
}

export function hashTerms(terms: {
  priceCents: number;
  calloutFeeCents: number;
  scopeDescription: string;
  deliveryMode: string;
  extraTerms?: string;
}): string {
  return crypto.createHash('sha256').update(JSON.stringify(terms, Object.keys(terms).sort())).digest('hex');
}

/** Create a new order in DRAFT state */
export async function createOrder(payeeId: string, payerId: string) {
  if (payeeId === payerId) {
    throw new AppError('VALIDATION_ERROR', 'Payer and payee cannot be the same', 400);
  }

  return withTx(async (tx) => {
    const [order] = await tx.insert(schema.orders).values({
      payerId,
      payeeId,
      state: 'DRAFT',
    }).returning();

    await tx.insert(schema.auditLog).values({
      tableName: 'orders',
      recordId: order.id,
      action: 'CREATE',
      actorId: payeeId,
      newValues: { payerId, payeeId, state: 'DRAFT' },
    }).execute();

    return order;
  });
}

/** Set or update terms — creates a new version and clears acceptances */
export async function setTerms(
  orderId: string,
  userId: string,
  terms: {
    priceCents: number;
    calloutFeeCents: number;
    scopeDescription: string;
    deliveryMode: 'in_person' | 'digital';
    extraTerms?: string;
  },
) {
  if (terms.priceCents <= 0) throw new AppError('VALIDATION_ERROR', 'Price must be positive', 400);

  return withTx(async (tx) => {
    // Lock the order row
    const [order] = await tx.select().from(schema.orders)
      .where(eq(schema.orders.id, orderId))
      .for('update')
      .limit(1);

    if (!order) throw new AppError('NOT_FOUND', 'Order not found', 404);
    if (order.payeeId !== userId) {
      throw new AppError('FORBIDDEN', 'Only the payee can set terms', 403);
    }
    if (!['DRAFT', 'PROPOSED'].includes(order.state)) {
      throw new AppError('ORDER_STATE_INVALID', `Cannot set terms in state ${order.state}`, 409);
    }

    const hash = hashTerms(terms);
    const newVersion = order.termsVersion + 1;

    // Insert the new version
    await tx.insert(schema.orderTermsVersions).values({
      orderId,
      version: newVersion,
      hash,
      priceCents: terms.priceCents,
      calloutFeeCents: terms.calloutFeeCents,
      scopeDescription: terms.scopeDescription,
      deliveryMode: terms.deliveryMode,
      extraTerms: terms.extraTerms,
      createdBy: userId,
    }).execute();

    // Increment order version as well (for optimistic locking)
    await tx.update(schema.orders)
      .set({
        termsVersion: newVersion,
        currentTermsHash: hash,
        priceCents: terms.priceCents,
        calloutFeeCents: terms.calloutFeeCents,
        deliveryMode: terms.deliveryMode,
        version: order.version + 1,
        updatedAt: new Date(),
        state: 'DRAFT', // Reset to draft so payer must re-accept new terms
      })
      .where(eq(schema.orders.id, orderId))
      .execute();

    // Clear acceptances since terms changed
    await tx.delete(schema.orderAcceptances)
      .where(eq(schema.orderAcceptances.orderId, orderId))
      .execute();

    await tx.insert(schema.auditLog).values({
      tableName: 'orders',
      recordId: orderId,
      action: 'SET_TERMS',
      actorId: userId,
      oldValues: { termsVersion: order.termsVersion, priceCents: order.priceCents },
      newValues: { termsVersion: newVersion, priceCents: terms.priceCents, hash },
    }).execute();

    // If order was proposed, transition back to DRAFT so payer re-evaluates
    if (order.state === 'PROPOSED') {
      await tx.update(schema.orders)
        .set({ state: 'DRAFT', version: order.version + 1 })
        .where(eq(schema.orders.id, orderId))
        .execute();
    }

    return { version: newVersion, hash };
  });
}

/** Payee proposes the order (moves from DRAFT to PROPOSED) */
export async function proposeOrder(orderId: string, userId: string) {
  return transition(orderId, userId, 'PROPOSED');
}

/** Payer accepts the current terms */
export async function acceptOrder(orderId: string, userId: string, termsVersion: number) {
  return withTx(async (tx) => {
    const [order] = await tx.select().from(schema.orders)
      .where(eq(schema.orders.id, orderId))
      .for('update')
      .limit(1);

    if (!order) throw new AppError('NOT_FOUND', 'Order not found', 404);
    const actor = getActorType(order, userId);
    if (actor !== 'payer') throw new AppError('FORBIDDEN', 'Only the payer can accept', 403);

    if (order.state !== 'PROPOSED') {
      throw new AppError('ORDER_STATE_INVALID', `Cannot accept in state ${order.state}`, 409);
    }

    // Check terms version — must match current
    if (termsVersion !== order.termsVersion) {
      throw new AppError('TERMS_STALE', `Terms version ${termsVersion} is stale. Current: ${order.termsVersion}`, 409);
    }

    // Record acceptance
    await tx.insert(schema.orderAcceptances).values({
      orderId,
      userId,
      termsVersion,
    }).onConflictDoNothing().execute();

    // Assess platform fee
    const feePercent = config.PLATFORM_FEE_PERCENT;
    const feeCents = Math.floor((order.priceCents ?? 0) * feePercent / 100);

    // Calculate funding deadline
    const fundingDeadline = new Date(Date.now() + config.FUNDING_WINDOW_MIN * 60 * 1000);

    await tx.update(schema.orders)
      .set({
        state: 'ACCEPTED',
        feeCents,
        fundingDeadline,
        version: order.version + 1,
        updatedAt: new Date(),
      })
      .where(eq(schema.orders.id, orderId))
      .execute();

    // Schedule timer for funding window
    await tx.insert(schema.timers).values({
      orderId,
      timerType: 'FUNDING_WINDOW',
      fireAt: fundingDeadline,
      action: 'CANCEL_UNFUNDED',
    }).execute();

    await tx.insert(schema.auditLog).values({
      tableName: 'orders',
      recordId: orderId,
      action: 'ACCEPT',
      actorId: userId,
      newValues: { state: 'ACCEPTED', termsVersion, feeCents, fundingDeadline },
    }).execute();

    return { state: 'ACCEPTED', feeCents, fundingDeadline };
  });
}

/** Core state transition engine */
async function transition(orderId: string, userId: string, targetState: string) {
  return withTx(async (tx) => {
    const [order] = await tx.select().from(schema.orders)
      .where(eq(schema.orders.id, orderId))
      .for('update')
      .limit(1);
    if (!order) throw new AppError('NOT_FOUND', 'Order not found', 404);

    const actor = getActorType(order, userId);

    // Find matching transition
    const transition = TRANSITIONS.find(
      (t) => t.from.includes(order.state) && t.actor === actor && t.to === targetState,
    );

    if (!transition) {
      throw new AppError(
        'ORDER_STATE_INVALID',
        `Transition from "${order.state}" to "${targetState}" by ${actor || 'unknown'} is not allowed`,
        409,
      );
    }

    // Run guard if any
    if (transition.guard) {
      await transition.guard(order, userId, tx);
    }

    // For system transitions, check from PROPOSED/ACCEPTED — we need a different flow
    // Actually let's handle FUNDED separately via payment service

    await tx.update(schema.orders)
      .set({
        state: targetState,
        version: order.version + 1,
        updatedAt: new Date(),
      })
      .where(eq(schema.orders.id, orderId))
      .execute();

    await tx.insert(schema.auditLog).values({
      tableName: 'orders',
      recordId: orderId,
      action: `STATE_${targetState}`,
      actorId: userId,
      oldValues: { state: order.state },
      newValues: { state: targetState },
    }).execute();

    return tx.select().from(schema.orders).where(eq(schema.orders.id, orderId)).limit(1).then(r => r[0]);
  });
}

/** Get order details (used by both parties and staff) */
export async function getOrder(orderId: string, userId: string, role?: string) {
  const [order] = await db.select().from(schema.orders)
    .where(eq(schema.orders.id, orderId))
    .limit(1);
  if (!order) throw new AppError('NOT_FOUND', 'Order not found', 404);

  const isStaff = role === 'admin' || role === 'support';
  if (order.payerId !== userId && order.payeeId !== userId && !isStaff) {
    throw new AppError('FORBIDDEN', 'Not a party to this order', 403);
  }

  const terms = await db.select()
    .from(schema.orderTermsVersions)
    .where(eq(schema.orderTermsVersions.orderId, orderId))
    .orderBy(schema.orderTermsVersions.version);

  const acceptances = await db.select()
    .from(schema.orderAcceptances)
    .where(eq(schema.orderAcceptances.orderId, orderId));

  return { ...order, terms, acceptances };
}

export async function listOrders(userId: string, role: string, page = 1, limit = 20) {
  const offset = (page - 1) * limit;

  let query = db.select().from(schema.orders);
  if (role !== 'admin') {
    query = query.where(
      sql`${schema.orders.payerId} = ${userId} OR ${schema.orders.payeeId} = ${userId}`
    ) as any;
  }

  const items = await (query as any).limit(limit).offset(offset).orderBy(schema.orders.createdAt);
  return { items, page, limit };
}

/** System-level transition (used by workers and payment callbacks) */
export async function systemTransition(orderId: string, targetState: string, metadata?: Record<string, unknown>) {
  return withTx(async (tx) => {
    const [order] = await tx.select().from(schema.orders)
      .where(eq(schema.orders.id, orderId))
      .for('update')
      .limit(1);
    if (!order) throw new AppError('NOT_FOUND', 'Order not found', 404);

    const transition = TRANSITIONS.find(
      (t) => t.from.includes(order.state) && t.actor === 'system' && t.to === targetState,
    );

    if (!transition && targetState !== 'FUNDED' && targetState !== 'RELEASED') {
      throw new AppError(
        'ORDER_STATE_INVALID',
        `System transition from "${order.state}" to "${targetState}" not allowed`,
        409,
      );
    }

    const updateData: any = {
      state: targetState,
      version: order.version + 1,
      updatedAt: new Date(),
    };

    if (targetState === 'FUNDED') updateData.paidAt = new Date();
    if (targetState === 'RELEASED') updateData.releasedAt = new Date();

    await tx.update(schema.orders)
      .set(updateData)
      .where(eq(schema.orders.id, orderId))
      .execute();

    await tx.insert(schema.auditLog).values({
      tableName: 'orders',
      recordId: orderId,
      action: `STATE_${targetState}`,
      actorId: '00000000-0000-0000-0000-000000000000',
      oldValues: { state: order.state },
      newValues: { state: targetState, ...metadata },
    }).execute();

    return tx.select().from(schema.orders).where(eq(schema.orders.id, orderId)).limit(1).then(r => r[0]);
  });
}

/** Payer check-in or payee digital delivery start (FUNDED → IN_PROGRESS) */
export async function startOrder(orderId: string, userId: string) {
  return transition(orderId, userId, 'IN_PROGRESS');
}

/** Payee marks the work delivered (IN_PROGRESS → DELIVERED) */
export async function deliverOrder(orderId: string, userId: string) {
  return transition(orderId, userId, 'DELIVERED');
}

/** Payer confirms the work (DELIVERED → COMPLETED) */
export async function completeOrder(orderId: string, userId: string) {
  return transition(orderId, userId, 'COMPLETED');
}

/** Cancel an order */
export async function cancelOrder(orderId: string, userId: string) {
  return transition(orderId, userId, 'CANCELLED');
}