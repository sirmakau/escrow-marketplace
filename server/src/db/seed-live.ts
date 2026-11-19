/**
 * One-shot live-database seed helper.
 *
 * Usage: DATABASE_URL="postgresql://..." npm run seed:live
 *
 * This script is intentionally outside the normal dev/migrate flow. It only
 * inserts the default admin/support/payer/payee users and wallets when they
 * are missing, so it is safe to re-run. It never writes to server/.env and
 * never commits secrets. The caller must supply DATABASE_URL; when running
 * locally, it falls back to server/.env.
 */

import postgres from 'postgres';
import dotenv from 'dotenv';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import argon2 from 'argon2';

const here = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Prefer the env passed by the caller; fall back to the local .env only when
// running from this machine. Render/CI will always supply DATABASE_URL.
const dotenvPath = path.join(here, '.env');
let dotenvParsed: Record<string, string | undefined> = {};
try {
  if (!process.env.DATABASE_URL) {
    dotenvParsed = dotenv.parse(fs.readFileSync(dotenvPath, 'utf8'));
  }
} catch {
  // If .env does not exist, proceed with whatever the shell provided.
}

const DATABASE_URL =
  process.env.DATABASE_URL ?? dotenvParsed.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('DATABASE_URL is not set.');
  console.error('Example: DATABASE_URL="postgresql://user:pass@host/db?sslmode=require" npm run seed:live');
  process.exit(2);
}

const queryClient = postgres(DATABASE_URL, {
  ssl: 'prefer',
  connect_timeout: 10,
  max: 1,
});

async function main() {
  let clientUsed = false;
  try {
    const info = await queryClient`SELECT current_database() AS db, inet_server_addr()::text AS host`;
    console.log('Connected to:', info[0].db, 'on', info[0].host);
    clientUsed = true;

    const existing = await queryClient`
      SELECT 1 FROM "users"
      WHERE phone = ${'+254700000001'}
      LIMIT 1
    `;
    if (existing.length > 0) {
      console.log('Default users already present; nothing inserted.');
      return;
    }

    console.log('Inserting default users and wallets...');
    const passwordHash = await argon2.hash('password123');

    const insertUser = `
      INSERT INTO "users" ("phone","password_hash","display_name","role","kyc_tier","created_at","updated_at")
      VALUES ($1, $2, $3, $4, $5, now(), now())
      RETURNING id
    `;

    const admin = (await queryClient.unsafe(insertUser, ['+254700000001', passwordHash, 'Admin User', 'admin', 2]))[0];
    const support = (await queryClient.unsafe(insertUser, ['+254700000002', passwordHash, 'Support User', 'support', 2]))[0];
    const payer = (await queryClient.unsafe(insertUser, ['+254712345678', passwordHash, 'Alice Payer', 'user', 1]))[0];
    const payee = (await queryClient.unsafe(insertUser, ['+254798765432', passwordHash, 'Bob Payee', 'user', 1]))[0];

    const insertWallet = `
      INSERT INTO "wallets" ("user_id","balance","held_balance","created_at","updated_at")
      VALUES ($1, 0, 0, now(), now())
    `;
    for (const u of [admin, support, payer, payee]) {
      await queryClient.unsafe(insertWallet, [u.id]);
    }

    console.log('Inserted users and wallets.');
    console.log('Admin:  +254700000001 / password123');
    console.log('Support: +254700000002 / password123');
    console.log('Payer:  +254712345678 / password123');
    console.log('Payee:  +254798765432 / password123');
  } catch (err: any) {
    if (!clientUsed) {
      console.error('Cannot reach database:', err?.message ?? err);
    } else {
      console.error('Seed failed:', err?.message ?? err);
    }
    process.exit(1);
  } finally {
    await queryClient.end().catch(() => {});
  }
}

main();
