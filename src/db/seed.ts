/**
 * Database seed script.
 *
 * Creates:
 *  - Two test users (payer and payee)
 *  - A support user and an admin user
 *  - Wallets for all
 *
 * Usage: npm run seed
 */

import { db, schema, withTx } from './client.js';
import * as argon2 from 'argon2';
import { generateId } from '../utils/helpers.js';

async function seed() {
  console.log('🌱 Seeding database...');

  const passwordHash = await argon2.hash('password123');

  await withTx(async (tx) => {
    // Create users
    const [admin] = await tx.insert(schema.users).values({
      phone: '+254700000001',
      passwordHash,
      displayName: 'Admin User',
      role: 'admin',
      kycTier: 2,
    }).returning();

    const [support] = await tx.insert(schema.users).values({
      phone: '+254700000002',
      passwordHash,
      displayName: 'Support User',
      role: 'support',
      kycTier: 2,
    }).returning();

    const [payer] = await tx.insert(schema.users).values({
      phone: '+254712345678',
      passwordHash,
      displayName: 'Alice Payer',
      role: 'user',
      kycTier: 1,
    }).returning();

    const [payee] = await tx.insert(schema.users).values({
      phone: '+254798765432',
      passwordHash,
      displayName: 'Bob Payee',
      role: 'user',
      kycTier: 1,
    }).returning();

    // Create wallets
    await tx.insert(schema.wallets).values([
      { userId: admin.id },
      { userId: support.id },
      { userId: payer.id },
      { userId: payee.id },
    ]).execute();

    console.log(`  ✅ Users created:`);
    console.log(`     Admin:  +254700000001 / password123`);
    console.log(`     Support: +254700000002 / password123`);
    console.log(`     Payer:  +254712345678 / password123`);
    console.log(`     Payee:  +254798765432 / password123`);
  });

  console.log('✅ Seed complete');
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});