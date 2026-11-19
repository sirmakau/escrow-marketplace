import { sql } from 'drizzle-orm';
import {
  pgTable, uuid, text, varchar, char, integer, bigint, jsonb, boolean,
  timestamp, uniqueIndex, index, check,
} from 'drizzle-orm/pg-core';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';

/* ──────────────── USERS ──────────────── */
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  phone: varchar('phone', { length: 14 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  displayName: varchar('display_name', { length: 100 }).notNull(),
  role: varchar('role', { length: 20 }).notNull().default('user'),
  kycTier: integer('kyc_tier').notNull().default(0),
  kycIdNumber: varchar('kyc_id_number', { length: 20 }),
  kycVerifiedAt: timestamp('kyc_verified_at'),
  failedLoginAttempts: integer('failed_login_attempts').notNull().default(0),
  lockedUntil: timestamp('locked_until'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  check('kyc_tier_check', sql`kyc_tier IN (0, 1, 2)`),
  check('role_check', sql`role IN ('user', 'support', 'admin')`),
]);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

/* ──────────────── REFRESH TOKENS ──────────────── */
export const refreshTokens = pgTable('refresh_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull().unique(),
  familyId: uuid('family_id').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  revokedAt: timestamp('revoked_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => [
  index('refresh_tokens_user_idx').on(t.userId),
  index('refresh_tokens_family_idx').on(t.familyId),
]);

/* ──────────────── WALLETS ──────────────── */
export const wallets = pgTable('wallets', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().unique().references(() => users.id, { onDelete: 'cascade' }),
  /** Balance in cents (KES minor units). Immutable; only ledger entries change it */
  balance: bigint('balance', { mode: 'number' }).notNull().default(0),
  heldBalance: bigint('held_balance', { mode: 'number' }).notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  check('balance_non_negative', sql`balance >= 0`),
  check('held_balance_non_negative', sql`held_balance >= 0`),
  check('wallet_balance_check', sql`balance >= 0 AND held_balance >= 0`),
]);

export type Wallet = typeof wallets.$inferSelect;

/* ──────────────── ORDERS ──────────────── */
export const orders = pgTable('orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  payerId: uuid('payer_id').notNull().references(() => users.id),
  payeeId: uuid('payee_id').notNull().references(() => users.id),
  state: varchar('state', { length: 30 }).notNull().default('DRAFT'),
  version: integer('version').notNull().default(1),
  termsVersion: integer('terms_version').notNull().default(0),
  currentTermsHash: varchar('current_terms_hash', { length: 64 }),
  /** Price in cents agreed in the terms */
  priceCents: bigint('price_cents', { mode: 'number' }),
  /** Platform fee in cents assessed */
  feeCents: bigint('fee_cents', { mode: 'number' }),
  /** Call-out fee in cents */
  calloutFeeCents: bigint('callout_fee_cents', { mode: 'number' }).default(0),
  /** Delivery mode: in_person | digital */
  deliveryMode: varchar('delivery_mode', { length: 20 }),
  /** Digital proof hash (SHA-256 of delivered file) */
  deliveryProofHash: varchar('delivery_proof_hash', { length: 64 }),
  fundingDeadline: timestamp('funding_deadline'),
  reviewDeadline: timestamp('review_deadline'),
  paidAt: timestamp('paid_at'),
  releasedAt: timestamp('released_at'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => [
  index('orders_payer_idx').on(t.payerId),
  index('orders_payee_idx').on(t.payeeId),
  index('orders_state_idx').on(t.state),
  check('order_participants_check', sql`payer_id <> payee_id`),
  check('order_price_check', sql`price_cents IS NULL OR price_cents > 0`),
  check(
    'order_fee_check',
    sql`(fee_cents IS NULL OR fee_cents >= 0) AND (callout_fee_cents IS NULL OR callout_fee_cents >= 0)`,
  ),
]);

export type Order = typeof orders.$inferSelect;
export type OrderState = Order['state'];

/* ──────────────── ORDER TERMS VERSIONS ──────────────── */
export const orderTermsVersions = pgTable('order_terms_versions', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderId: uuid('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  version: integer('version').notNull(),
  /** SHA-256 hash of serialised terms — content-addressable */
  hash: varchar('hash', { length: 64 }).notNull(),
  priceCents: bigint('price_cents', { mode: 'number' }).notNull(),
  calloutFeeCents: bigint('callout_fee_cents', { mode: 'number' }).notNull().default(0),
  scopeDescription: text('scope_description').notNull(),
  deliveryMode: varchar('delivery_mode', { length: 20 }).notNull(),
  extraTerms: text('extra_terms'),
  createdBy: uuid('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => [
  uniqueIndex('order_terms_unique').on(t.orderId, t.version),
  check('terms_price_check', sql`price_cents > 0 AND callout_fee_cents >= 0`),
]);

/* ──────────────── ORDER ACCEPTANCES ──────────────── */
export const orderAcceptances = pgTable('order_acceptances', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderId: uuid('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id),
  termsVersion: integer('terms_version').notNull(),
  acceptedAt: timestamp('accepted_at').notNull().defaultNow(),
}, (t) => [
  uniqueIndex('order_user_terms_acceptance').on(t.orderId, t.userId, t.termsVersion),
  index('order_acceptances_user_idx').on(t.userId),
]);

/* ──────────────── LEDGER (append-only double-entry) ──────────────── */
export const ledgerEntries = pgTable('ledger_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  transactionId: uuid('transaction_id').notNull(),
  orderId: uuid('order_id').references(() => orders.id),
  /** debited account: user_id or 'platform' or 'mpesa_float' */
  fromAccount: varchar('from_account', { length: 50 }).notNull(),
  toAccount: varchar('to_account', { length: 50 }).notNull(),
  /** Amount in cents, always positive. Direction is from→to */
  amountCents: bigint('amount_cents', { mode: 'number' }).notNull(),
  reason: varchar('reason', { length: 100 }).notNull(),
  refType: varchar('ref_type', { length: 30 }),
  refId: varchar('ref_id', { length: 100 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => [
  index('ledger_order_idx').on(t.orderId),
  index('ledger_transaction_idx').on(t.transactionId),
  check('amount_positive', sql`amount_cents > 0`),
]);

/* ──────────────── M-PESA PAYMENTS ──────────────── */
export const mpesaPayments = pgTable('mpesa_payments', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderId: uuid('order_id').notNull().references(() => orders.id),
  userId: uuid('user_id').notNull().references(() => users.id),
  type: varchar('type', { length: 20 }).notNull(),
  direction: varchar('direction', { length: 10 }).notNull(),
  amountCents: bigint('amount_cents', { mode: 'number' }).notNull(),
  checkoutRequestId: varchar('checkout_request_id', { length: 100 }),
  mpesaReceiptNumber: varchar('mpesa_receipt_number', { length: 100 }),
  conversationId: varchar('conversation_id', { length: 100 }),
  originatorConversationId: varchar('originator_conversation_id', { length: 100 }),
  resultCode: integer('result_code'),
  resultDesc: text('result_desc'),
  /** Full raw callback body for audit */
  rawCallback: jsonb('raw_callback'),
  status: varchar('status', { length: 20 }).notNull().default('PENDING'),
  retryCount: integer('retry_count').notNull().default(0),
  nextRetryAt: timestamp('next_retry_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => [
  index('mpesa_order_idx').on(t.orderId),
  index('mpesa_user_idx').on(t.userId),
  index('mpesa_checkout_req_idx').on(t.checkoutRequestId),
  uniqueIndex('mpesa_receipt_unique').on(t.mpesaReceiptNumber),
  check('mpesa_amount_check', sql`amount_cents > 0`),
  check('mpesa_retry_check', sql`retry_count >= 0`),
]);

/* ──────────────── LEDGER ACCOUNTS (chart of accounts) ──────────────── */
export const ledgerAccounts = pgTable('ledger_accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  accountCode: varchar('account_code', { length: 60 }).notNull(),
  accountName: varchar('account_name', { length: 120 }).notNull(),
  accountType: varchar('account_type', { length: 20 }).notNull(),
  currency: char('currency', { length: 3 }).notNull().default('KES'),
  ownerUserId: uuid('owner_user_id').references(() => users.id),
  orderId: uuid('order_id').references(() => orders.id),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('ledger_order_account_unique').on(t.orderId, t.accountCode, t.currency),
  uniqueIndex('ledger_platform_account_unique').on(t.accountCode, t.currency),
  uniqueIndex('ledger_user_account_unique').on(t.ownerUserId, t.accountCode, t.currency),
  check(
    'ledger_account_scope_check',
    sql`((account_code IN ('USER_WALLET_AVAILABLE', 'USER_WALLET_HELD') AND owner_user_id IS NOT NULL AND order_id IS NULL)
      OR (account_code = 'ORDER_ESCROW' AND owner_user_id IS NULL AND order_id IS NOT NULL)
      OR (account_code NOT IN ('USER_WALLET_AVAILABLE', 'USER_WALLET_HELD', 'ORDER_ESCROW') AND owner_user_id IS NULL AND order_id IS NULL))`,
  ),
  check(
    'ledger_account_type_check',
    sql`account_type IN ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE')`,
  ),
]);

export type LedgerAccount = typeof ledgerAccounts.$inferSelect;

/* ──────────────── LEDGER TRANSACTIONS (journal headers) ──────────────── */
export const ledgerTransactions = pgTable('ledger_transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  idempotencyKey: varchar('idempotency_key', { length: 200 }).notNull().unique(),
  transactionType: varchar('transaction_type', { length: 50 }).notNull(),
  description: text('description'),
  orderId: uuid('order_id').references(() => orders.id),
  paymentId: uuid('payment_id').references(() => mpesaPayments.id),
  currency: char('currency', { length: 3 }).notNull().default('KES'),
  reversesTransactionId: uuid('reverses_transaction_id').references((): AnyPgColumn => ledgerTransactions.id),
  createdBy: uuid('created_by').references(() => users.id),
  postedAt: timestamp('posted_at', { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('ledger_reversal_unique').on(t.reversesTransactionId),
  index('ledger_transactions_created_idx').on(t.createdAt),
  index('ledger_transactions_order_idx').on(t.orderId),
  index('ledger_transactions_payment_idx').on(t.paymentId),
  check(
    'ledger_transaction_type_check',
    sql`transaction_type IN ('MPESA_DEPOSIT', 'WALLET_TRANSFER', 'ESCROW_FUNDING', 'ESCROW_RELEASE', 'ESCROW_REFUND', 'PLATFORM_FEE', 'SELLER_PAYOUT', 'WALLET_WITHDRAWAL', 'MANUAL_ADJUSTMENT', 'REVERSAL')`,
  ),
]);

export type LedgerTransaction = typeof ledgerTransactions.$inferSelect;

/* ──────────────── LEDGER POSTINGS (debits and credits) ──────────────── */
export const ledgerPostings = pgTable('ledger_postings', {
  id: uuid('id').primaryKey().defaultRandom(),
  transactionId: uuid('transaction_id').notNull().references(() => ledgerTransactions.id),
  accountId: uuid('account_id').notNull().references(() => ledgerAccounts.id),
  debitCents: bigint('debit_cents', { mode: 'number' }).notNull().default(0),
  creditCents: bigint('credit_cents', { mode: 'number' }).notNull().default(0),
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('ledger_postings_account_idx').on(t.accountId),
  index('ledger_postings_transaction_idx').on(t.transactionId),
  check(
    'ledger_posting_amount_check',
    sql`(debit_cents > 0 AND credit_cents = 0) OR (credit_cents > 0 AND debit_cents = 0)`,
  ),
]);

export type LedgerPosting = typeof ledgerPostings.$inferSelect;

/* ──────────────── WEBHOOK EVENTS ──────────────── */
export const webhookEvents = pgTable('webhook_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  source: varchar('source', { length: 50 }).notNull(),
  /** Idempotency key — the external ID that makes this webhook unique */
  idempotencyKey: varchar('idempotency_key', { length: 200 }).notNull().unique(),
  orderId: uuid('order_id').references(() => orders.id),
  eventType: varchar('event_type', { length: 50 }).notNull(),
  rawBody: jsonb('raw_body'),
  processedAt: timestamp('processed_at'),
  error: text('error'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => [
  index('webhook_order_idx').on(t.orderId),
  index('webhook_unprocessed_idx').on(t.createdAt),
]);

/* ──────────────── DISPUTES ──────────────── */
export const disputes = pgTable('disputes', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderId: uuid('order_id').notNull().references(() => orders.id),
  openedBy: uuid('opened_by').notNull().references(() => users.id),
  reason: varchar('reason', { length: 50 }).notNull(),
  description: text('description').notNull(),
  status: varchar('status', { length: 20 }).notNull().default('OPEN'),
  resolvedAt: timestamp('resolved_at'),
  resolution: varchar('resolution', { length: 50 }),
  resolvedBy: uuid('resolved_by').references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => [
  check("dispute_status_check", sql`status IN ('OPEN', 'IN_REVIEW', 'RESOLVED', 'REJECTED')`),
  check("dispute_resolution_check", sql`resolution IN ('REFUND_PAYER', 'RELEASE_PAYEE', 'SPLIT')`),
]);

export const disputeEvidence = pgTable('dispute_evidence', {
  id: uuid('id').primaryKey().defaultRandom(),
  disputeId: uuid('dispute_id').notNull().references(() => disputes.id, { onDelete: 'cascade' }),
  uploadedBy: uuid('uploaded_by').notNull().references(() => users.id),
  description: text('description'),
  fileUrl: varchar('file_url', { length: 500 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

/* ──────────────── AUDIT LOG ──────────────── */
export const auditLog = pgTable('audit_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  tableName: varchar('table_name', { length: 50 }).notNull(),
  recordId: uuid('record_id'),
  action: varchar('action', { length: 30 }).notNull(),
  actorId: uuid('actor_id').references(() => users.id),
  oldValues: jsonb('old_values'),
  newValues: jsonb('new_values'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => [
  index('audit_log_record_idx').on(t.tableName, t.recordId),
  index('audit_log_created_idx').on(t.createdAt),
]);

/* ──────────────── TIMERS ──────────────── */
export const timers = pgTable('timers', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderId: uuid('order_id').notNull().references(() => orders.id).unique(),
  timerType: varchar('timer_type', { length: 30 }).notNull(),
  fireAt: timestamp('fire_at').notNull(),
  firedAt: timestamp('fired_at'),
  action: varchar('action', { length: 50 }).notNull(),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => [
  index('timers_fire_idx').on(t.fireAt, t.firedAt),
  check("timer_type_check", sql`timer_type IN ('FUNDING_WINDOW', 'REVIEW_WINDOW', 'PAYOUT_RETRY', 'NO_SHOW')`),
]);