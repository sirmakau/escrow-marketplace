import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { config } from '../config/index.js';
import * as schema from './schema/index.js';

const queryClient = postgres(config.DATABASE_URL, {
  max: 20,
  idle_timeout: 20,
  connect_timeout: 10,
  // For Neon — enforce SSL
  ssl: config.NODE_ENV === 'production' ? 'require' : 'prefer',
});

export const db = drizzle(queryClient, { schema, logger: config.NODE_ENV === 'development' });

export type DB = typeof db;

export { schema };

/** Helper: run inside a DB transaction with a fresh query client for the tx */
export async function withTx<T>(fn: (tx: DB) => Promise<T>): Promise<T> {
  return await db.transaction(async (tx) => {
    return fn(tx as unknown as DB);
  });
}