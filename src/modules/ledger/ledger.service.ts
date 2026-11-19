import { db, schema } from '../../db/client.js';
import { eq, desc, and, sql } from 'drizzle-orm';

export interface LedgerEntryInput {
  transactionId: string;
  orderId?: string;
  fromAccount: string;
  toAccount: string;
  amountCents: number;
  reason: string;
  refType?: string;
  refId?: string;
}

/**
 * Double-entry bookkeeping: every entry records a transfer from one account
 * to another. For a transaction to be balanced, total debits = total credits.
 * We enforce balance at the application layer via CHECK constraints.
 */
export async function createLedgerEntry(entry: LedgerEntryInput) {
  const [result] = await db.insert(schema.ledgerEntries).values({
    transactionId: entry.transactionId,
    orderId: entry.orderId,
    fromAccount: entry.fromAccount,
    toAccount: entry.toAccount,
    amountCents: entry.amountCents,
    reason: entry.reason,
    refType: entry.refType,
    refId: entry.refId,
  }).returning();
  return result;
}

/**
 * Create balanced double-entry (two rows). Verifies amounts match.
 */
export async function createDoubleEntry(
  transactionId: string,
  debit: { account: string; amountCents: number },
  credit: { account: string; amountCents: number },
  reason: string,
  orderId?: string,
  refType?: string,
  refId?: string,
) {
  if (debit.amountCents !== credit.amountCents) {
    throw new Error(`Double-entry mismatch: debit ${debit.amountCents} != credit ${credit.amountCents}`);
  }

  const [a, b] = await db.insert(schema.ledgerEntries).values([
    {
      transactionId,
      orderId,
      fromAccount: debit.account,
      toAccount: credit.account,
      amountCents: debit.amountCents,
      reason,
      refType,
      refId,
    },
    // Mirror entry for the receiving side
    {
      transactionId,
      orderId,
      fromAccount: credit.account,
      toAccount: debit.account,
      amountCents: 0, // informational only; real credits tracked by the first row
      reason: reason + '_mirror',
      refType,
      refId,
    },
  ]).returning();

  return [a, b];
}

export async function getLedgerForOrder(orderId: string) {
  return db.select()
    .from(schema.ledgerEntries)
    .where(eq(schema.ledgerEntries.orderId, orderId))
    .orderBy(desc(schema.ledgerEntries.createdAt));
}

export async function verifyTransactionBalance(transactionId: string): Promise<boolean> {
  const entries = await db.select()
    .from(schema.ledgerEntries)
    .where(eq(schema.ledgerEntries.transactionId, transactionId));

  // Sum all from→to as net flow
  let net = 0;
  for (const entry of entries) {
    net += entry.amountCents;
  }
  return net === 0;
}