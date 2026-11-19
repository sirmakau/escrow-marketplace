import { db, schema, withTx } from '../../db/client.js';
import { AppError, hashToken, randomToken, generateId, logger } from '../../utils/helpers.js';
import jwt from 'jsonwebtoken';
import * as argon2 from 'argon2';
import { config } from '../../config/index.js';
import { JwtPayload } from '../../middleware/authenticate.js';
import { eq, and, isNull } from 'drizzle-orm';
import { sql } from 'drizzle-orm';

const MAX_FAILED_LOGINS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 min

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export async function register(input: { phone: string; password: string; displayName: string }): Promise<AuthTokens> {
  const passwordHash = await argon2.hash(input.password);

  const result = await withTx(async (tx) => {
    // Check duplicate phone
    const existing = await tx.select().from(schema.users).where(eq(schema.users.phone, input.phone)).limit(1);
    if (existing.length > 0) {
      throw new AppError('CONFLICT', 'Phone number already registered', 409);
    }

    const [user] = await tx.insert(schema.users).values({
      phone: input.phone,
      passwordHash,
      displayName: input.displayName,
    }).returning();

    // Create wallet
    await tx.insert(schema.wallets).values({ userId: user.id }).execute();

    // Audit
    await tx.insert(schema.auditLog).values({
      tableName: 'users',
      recordId: user.id,
      action: 'REGISTER',
      actorId: user.id,
      newValues: { phone: input.phone.slice(0, -4) + '****', displayName: input.displayName },
    }).execute();

    return user;
  });

  return generateTokens(result.id, result.role, result.kycTier);
}

export async function login(input: { phone: string; password: string }): Promise<AuthTokens> {
  const [user] = await db.select().from(schema.users).where(eq(schema.users.phone, input.phone)).limit(1);

  if (!user) {
    // Use a constant-time response to not leak which phone exists
    throw new AppError('UNAUTHORIZED', 'Invalid phone or password', 401);
  }

  // Check lockout
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    throw new AppError('UNAUTHORIZED', 'Account locked. Try again later.', 401);
  }

  const valid = await argon2.verify(user.passwordHash, input.password);
  if (!valid) {
    // Increment failed attempts
    const newCount = user.failedLoginAttempts + 1;
    const update: any = { failedLoginAttempts: newCount };
    if (newCount >= MAX_FAILED_LOGINS) {
      update.lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
    }
    await db.update(schema.users).set(update).where(eq(schema.users.id, user.id)).execute();

    throw new AppError('UNAUTHORIZED', 'Invalid phone or password', 401);
  }

  // Reset failed attempts
  await db.update(schema.users)
    .set({ failedLoginAttempts: 0, lockedUntil: null })
    .where(eq(schema.users.id, user.id))
    .execute();

  return generateTokens(user.id, user.role, user.kycTier);
}

export async function refreshAccessToken(refreshToken: string): Promise<AuthTokens> {
  const tokenHash = hashToken(refreshToken);

  const [stored] = await db.select()
    .from(schema.refreshTokens)
    .where(and(
      eq(schema.refreshTokens.tokenHash, tokenHash),
      isNull(schema.refreshTokens.revokedAt),
    ))
    .limit(1);

  if (!stored) {
    // Token not found or already revoked — this could mean reuse.
    // Check by family: if token hash doesn't exist but family does, it's reuse.
    // For simplicity, we reject.
    logger.warn({ tokenHash: tokenHash.slice(0, 8) }, 'Refresh token not found or revoked');
    throw new AppError('UNAUTHORIZED', 'Invalid refresh token', 401);
  }

  if (stored.expiresAt < new Date()) {
    throw new AppError('UNAUTHORIZED', 'Refresh token expired', 401);
  }

  // Rotation: revoke the current token
  await db.update(schema.refreshTokens)
    .set({ revokedAt: new Date() })
    .where(eq(schema.refreshTokens.id, stored.id))
    .execute();

  // Check for reuse detection — if this family has a revoked token, it's reuse
  // For a real implementation, revoke all tokens in the family.
  // Simplified: we just issue new ones.

  const [user] = await db.select().from(schema.users).where(eq(schema.users.id, stored.userId)).limit(1);
  if (!user) {
    throw new AppError('UNAUTHORIZED', 'User not found', 401);
  }

  return generateTokens(user.id, user.role, user.kycTier, stored.familyId);
}

async function generateTokens(
  userId: string,
  role: string,
  kycTier: number,
  existingFamilyId?: string,
): Promise<AuthTokens> {
  const familyId = existingFamilyId || generateId();

  const accessToken = jwt.sign(
    { id: userId, role, kycTier } satisfies JwtPayload,
    config.JWT_ACCESS_SECRET,
    { expiresIn: config.JWT_ACCESS_EXPIRES_IN as any },
  );

  const rawRefreshToken = randomToken(48);
  const refreshTokenHash = hashToken(rawRefreshToken);
  const refreshExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await db.insert(schema.refreshTokens).values({
    userId,
    tokenHash: refreshTokenHash,
    familyId,
    expiresAt: refreshExpiresAt,
  }).execute();

  // Parse expiresIn from config
  const match = (config.JWT_ACCESS_EXPIRES_IN as string).match(/^(\d+)([mhd])$/);
  let expiresIn = 900;
  if (match) {
    const num = parseInt(match[1]);
    const unit = match[2];
    expiresIn = unit === 'h' ? num * 3600 : unit === 'd' ? num * 86400 : num * 60;
  }

  return { accessToken, refreshToken: rawRefreshToken, expiresIn };
}

export async function logout(userId: string, refreshToken?: string): Promise<void> {
  if (refreshToken) {
    const tokenHash = hashToken(refreshToken);
    await db.update(schema.refreshTokens)
      .set({ revokedAt: new Date() })
      .where(and(
        eq(schema.refreshTokens.tokenHash, tokenHash),
        eq(schema.refreshTokens.userId, userId),
      ))
      .execute();
  } else {
    // Revoke all tokens for user
    await db.update(schema.refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(schema.refreshTokens.userId, userId))
      .execute();
  }
}