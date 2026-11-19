import { db, schema } from '../../db/client.js';
import { AppError } from '../../utils/helpers.js';
import { eq, desc, sql } from 'drizzle-orm';

export async function getDashboardStats() {
  const [userCount] = await db.select({ count: db.$count(schema.users) }).from(schema.users);
  const [orderCount] = await db.select({ count: db.$count(schema.orders) }).from(schema.orders);
  const [disputeCount] = await db.select({ count: db.$count(schema.disputes) }).from(schema.disputes);

  const revenue = await db.select({
    total: sql<number>`COALESCE(SUM(amount_cents), 0)`,
  })
    .from(schema.ledgerEntries)
    .where(eq(schema.ledgerEntries.reason, 'platform_fee'));

  return {
    users: userCount?.count ?? 0,
    orders: orderCount?.count ?? 0,
    disputes: disputeCount?.count ?? 0,
    revenue: revenue[0]?.total ?? 0,
  };
}

export async function listAllLedgerEntries(page = 1, limit = 50) {
  const offset = (page - 1) * limit;
  const items = await db.select()
    .from(schema.ledgerEntries)
    .limit(limit)
    .offset(offset)
    .orderBy(desc(schema.ledgerEntries.createdAt));

  const [total] = await db.select({ count: db.$count(schema.ledgerEntries) }).from(schema.ledgerEntries);
  return { items, total: total?.count ?? 0, page, limit };
}

export async function listAuditLog(tableName?: string, recordId?: string, page = 1, limit = 50) {
  const offset = (page - 1) * limit;
  let query = db.select().from(schema.auditLog);

  if (tableName) query = query.where(eq(schema.auditLog.tableName, tableName)) as any;
  if (recordId) query = query.where(eq(schema.auditLog.recordId, recordId)) as any;

  const items = await (query as any).limit(limit).offset(offset).orderBy(desc(schema.auditLog.createdAt));
  return { items, page, limit };
}

export async function updateOrderStateByAdmin(orderId: string, newState: string, userId: string) {
  const [order] = await db.select().from(schema.orders).where(eq(schema.orders.id, orderId)).limit(1);
  if (!order) throw new AppError('NOT_FOUND', 'Order not found', 404);

  const [updated] = await db.update(schema.orders)
    .set({ state: newState, version: order.version + 1, updatedAt: new Date() })
    .where(eq(schema.orders.id, orderId))
    .returning();

  await db.insert(schema.auditLog).values({
    tableName: 'orders',
    recordId: orderId,
    action: 'ADMIN_FORCE_STATE',
    actorId: userId,
    oldValues: { state: order.state },
    newValues: { state: newState },
  }).execute();

  return updated;
}