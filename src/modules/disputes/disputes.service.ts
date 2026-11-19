import { db, schema, withTx } from '../../db/client.js';
import { AppError, generateId, logger } from '../../utils/helpers.js';
import { eq, and, asc, desc } from 'drizzle-orm';

export async function openDispute(
  orderId: string,
  userId: string,
  reason: string,
  description: string,
) {
  return withTx(async (tx) => {
    const [order] = await tx.select().from(schema.orders)
      .where(eq(schema.orders.id, orderId))
      .for('update')
      .limit(1);

    if (!order) throw new AppError('NOT_FOUND', 'Order not found', 404);
    if (order.payerId !== userId && order.payeeId !== userId) {
      throw new AppError('FORBIDDEN', 'Not a party to this order', 403);
    }

    // Check order is in a dispute-eligible state
    const eligibleStates = ['FUNDED', 'IN_PROGRESS', 'DELIVERED', 'COMPLETED'];
    if (!eligibleStates.includes(order.state)) {
      throw new AppError('ORDER_STATE_INVALID', `Cannot dispute in state ${order.state}`, 409);
    }

    // Check no existing open dispute
    const [existing] = await tx.select()
      .from(schema.disputes)
      .where(and(
        eq(schema.disputes.orderId, orderId),
        eq(schema.disputes.status, 'OPEN'),
      ))
      .limit(1);

    if (existing) {
      throw new AppError('CONFLICT', 'An open dispute already exists for this order', 409);
    }

    const [dispute] = await tx.insert(schema.disputes).values({
      orderId,
      openedBy: userId,
      reason,
      description,
    }).returning();

    // Move order to DISPUTED
    await tx.update(schema.orders)
      .set({ state: 'DISPUTED', version: order.version + 1, updatedAt: new Date() })
      .where(eq(schema.orders.id, orderId))
      .execute();

    await tx.insert(schema.auditLog).values({
      tableName: 'disputes',
      recordId: dispute.id,
      action: 'OPEN',
      actorId: userId,
      newValues: { orderId, reason, description },
    }).execute();

    return dispute;
  });
}

export async function resolveDispute(
  disputeId: string,
  resolution: 'REFUND_PAYER' | 'RELEASE_PAYEE' | 'SPLIT',
  resolvedBy: string,
  notes?: string,
) {
  return withTx(async (tx) => {
    const [dispute] = await tx.select().from(schema.disputes)
      .where(eq(schema.disputes.id, disputeId))
      .for('update')
      .limit(1);

    if (!dispute) throw new AppError('NOT_FOUND', 'Dispute not found', 404);
    if (dispute.status !== 'OPEN' && dispute.status !== 'IN_REVIEW') {
      throw new AppError('CONFLICT', 'Dispute is already resolved', 409);
    }

    const [updated] = await tx.update(schema.disputes)
      .set({
        status: 'RESOLVED',
        resolution,
        resolvedAt: new Date(),
        resolvedBy,
      })
      .where(eq(schema.disputes.id, disputeId))
      .returning();

    await tx.insert(schema.auditLog).values({
      tableName: 'disputes',
      recordId: disputeId,
      action: 'RESOLVE',
      actorId: resolvedBy,
      oldValues: { status: dispute.status },
      newValues: { status: 'RESOLVED', resolution },
      metadata: { notes },
    }).execute();

    return updated;
  });
}

export async function getDispute(disputeId: string) {
  const [dispute] = await db.select()
    .from(schema.disputes)
    .where(eq(schema.disputes.id, disputeId))
    .limit(1);
  if (!dispute) throw new AppError('NOT_FOUND', 'Dispute not found', 404);

  const evidence = await db.select()
    .from(schema.disputeEvidence)
    .where(eq(schema.disputeEvidence.disputeId, disputeId))
    .orderBy(asc(schema.disputeEvidence.createdAt));

  return { ...dispute, evidence };
}

export async function listDisputes(page = 1, limit = 20) {
  const offset = (page - 1) * limit;
  const items = await db.select()
    .from(schema.disputes)
    .limit(limit)
    .offset(offset)
    .orderBy(desc(schema.disputes.createdAt));
  const total = await db.select({ count: db.$count(schema.disputes) }).from(schema.disputes).then(r => r[0]?.count ?? 0);
  return { items, total, page, limit };
}

