import { db, schema, withTx } from '../../db/client.js';
import { AppError } from '../../utils/helpers.js';
import { eq } from 'drizzle-orm';
import { users, wallets, auditLog } from '../../db/schema/index.js';

export async function getUser(userId: string) {
  const [user] = await db.select({
    id: users.id,
    phone: users.phone,
    displayName: users.displayName,
    role: users.role,
    kycTier: users.kycTier,
    kycVerifiedAt: users.kycVerifiedAt,
    createdAt: users.createdAt,
  }).from(users).where(eq(users.id, userId)).limit(1);

  if (!user) throw new AppError('NOT_FOUND', 'User not found', 404);
  return user;
}

export async function getWallet(userId: string) {
  const [wallet] = await db.select()
    .from(wallets)
    .where(eq(wallets.userId, userId))
    .limit(1);

  if (!wallet) throw new AppError('NOT_FOUND', 'Wallet not found', 404);
  return wallet;
}

export async function upgradeKyc(
  userId: string,
  kycTier: number,
  kycIdNumber: string,
  actorId: string,
) {
  if (kycTier < 1 || kycTier > 2) {
    throw new AppError('VALIDATION_ERROR', 'KYC tier must be 1 or 2');
  }

  return withTx(async (tx) => {
    const [user] = await tx.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) throw new AppError('NOT_FOUND', 'User not found', 404);

    if (user.kycTier >= kycTier) {
      throw new AppError('CONFLICT', `User already at KYC tier ${user.kycTier}`, 409);
    }

    const [updated] = await tx.update(users)
      .set({
        kycTier,
        kycIdNumber,
        kycVerifiedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();

    await tx.insert(auditLog).values({
      tableName: 'users',
      recordId: userId,
      action: 'KYC_UPGRADE',
      actorId,
      oldValues: { kycTier: user.kycTier },
      newValues: { kycTier, kycIdNumber: kycIdNumber.slice(0, -4) + '****' },
    }).execute();

    return updated;
  });
}

export async function listUsers(page: number = 1, limit: number = 20) {
  const offset = (page - 1) * limit;
  const items = await db.select({
    id: users.id,
    phone: users.phone,
    displayName: users.displayName,
    role: users.role,
    kycTier: users.kycTier,
    createdAt: users.createdAt,
  }).from(users).limit(limit).offset(offset).orderBy(users.createdAt);

  const [countResult] = await db.select({ count: db.$count(users) }).from(users);
  const total = countResult?.count ?? 0;

  return { items, total, page, limit };
}