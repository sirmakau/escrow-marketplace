CREATE SCHEMA "public";
CREATE SCHEMA "auth";
CREATE ROLE "anonymous";
CREATE ROLE "authenticated";
CREATE ROLE "authenticator" WITH NOINHERIT LOGIN;
CREATE ROLE "cloud_admin" WITH SUPERUSER CREATEDB CREATEROLE LOGIN REPLICATION BYPASSRLS;
CREATE ROLE "neon_service" WITH CREATEDB CREATEROLE LOGIN REPLICATION BYPASSRLS;
CREATE ROLE "neon_superuser" WITH CREATEDB CREATEROLE REPLICATION BYPASSRLS;
CREATE ROLE "neondb_owner" WITH CREATEDB CREATEROLE LOGIN REPLICATION BYPASSRLS;
CREATE ROLE "pg_checkpoint";
CREATE ROLE "pg_create_subscription";
CREATE ROLE "pg_database_owner";
CREATE ROLE "pg_execute_server_program";
CREATE ROLE "pg_maintain";
CREATE ROLE "pg_monitor";
CREATE ROLE "pg_read_all_data";
CREATE ROLE "pg_read_all_settings";
CREATE ROLE "pg_read_all_stats";
CREATE ROLE "pg_read_server_files";
CREATE ROLE "pg_signal_autovacuum_worker";
CREATE ROLE "pg_signal_backend";
CREATE ROLE "pg_stat_scan_tables";
CREATE ROLE "pg_use_reserved_connections";
CREATE ROLE "pg_write_all_data";
CREATE ROLE "pg_write_server_files";
CREATE ROLE "token_roles";
GRANT DELETE ON "audit_log" TO "authenticated";
GRANT INSERT ON "audit_log" TO "authenticated";
GRANT SELECT ON "audit_log" TO "authenticated";
GRANT UPDATE ON "audit_log" TO "authenticated";
GRANT INSERT ON "audit_log" TO "neondb_owner" WITH GRANT OPTION;
GRANT SELECT ON "audit_log" TO "neondb_owner" WITH GRANT OPTION;
GRANT UPDATE ON "audit_log" TO "neondb_owner" WITH GRANT OPTION;
GRANT DELETE ON "audit_log" TO "neondb_owner" WITH GRANT OPTION;
GRANT TRUNCATE ON "audit_log" TO "neondb_owner" WITH GRANT OPTION;
GRANT REFERENCES ON "audit_log" TO "neondb_owner" WITH GRANT OPTION;
GRANT TRIGGER ON "audit_log" TO "neondb_owner" WITH GRANT OPTION;
GRANT INSERT ON "dispute_evidence" TO "authenticated";
GRANT SELECT ON "dispute_evidence" TO "authenticated";
GRANT UPDATE ON "dispute_evidence" TO "authenticated";
GRANT DELETE ON "dispute_evidence" TO "authenticated";
GRANT INSERT ON "dispute_evidence" TO "neondb_owner" WITH GRANT OPTION;
GRANT SELECT ON "dispute_evidence" TO "neondb_owner" WITH GRANT OPTION;
GRANT UPDATE ON "dispute_evidence" TO "neondb_owner" WITH GRANT OPTION;
GRANT DELETE ON "dispute_evidence" TO "neondb_owner" WITH GRANT OPTION;
GRANT TRUNCATE ON "dispute_evidence" TO "neondb_owner" WITH GRANT OPTION;
GRANT REFERENCES ON "dispute_evidence" TO "neondb_owner" WITH GRANT OPTION;
GRANT TRIGGER ON "dispute_evidence" TO "neondb_owner" WITH GRANT OPTION;
GRANT DELETE ON "disputes" TO "authenticated";
GRANT INSERT ON "disputes" TO "authenticated";
GRANT SELECT ON "disputes" TO "authenticated";
GRANT UPDATE ON "disputes" TO "authenticated";
GRANT INSERT ON "disputes" TO "neondb_owner" WITH GRANT OPTION;
GRANT TRIGGER ON "disputes" TO "neondb_owner" WITH GRANT OPTION;
GRANT REFERENCES ON "disputes" TO "neondb_owner" WITH GRANT OPTION;
GRANT TRUNCATE ON "disputes" TO "neondb_owner" WITH GRANT OPTION;
GRANT DELETE ON "disputes" TO "neondb_owner" WITH GRANT OPTION;
GRANT UPDATE ON "disputes" TO "neondb_owner" WITH GRANT OPTION;
GRANT SELECT ON "disputes" TO "neondb_owner" WITH GRANT OPTION;
GRANT INSERT ON "ledger_accounts" TO "authenticated";
GRANT DELETE ON "ledger_accounts" TO "authenticated";
GRANT UPDATE ON "ledger_accounts" TO "authenticated";
GRANT SELECT ON "ledger_accounts" TO "authenticated";
GRANT SELECT ON "ledger_accounts" TO "neondb_owner" WITH GRANT OPTION;
GRANT TRUNCATE ON "ledger_accounts" TO "neondb_owner" WITH GRANT OPTION;
GRANT DELETE ON "ledger_accounts" TO "neondb_owner" WITH GRANT OPTION;
GRANT UPDATE ON "ledger_accounts" TO "neondb_owner" WITH GRANT OPTION;
GRANT INSERT ON "ledger_accounts" TO "neondb_owner" WITH GRANT OPTION;
GRANT TRIGGER ON "ledger_accounts" TO "neondb_owner" WITH GRANT OPTION;
GRANT REFERENCES ON "ledger_accounts" TO "neondb_owner" WITH GRANT OPTION;
GRANT DELETE ON "ledger_entries" TO "authenticated";
GRANT UPDATE ON "ledger_entries" TO "authenticated";
GRANT SELECT ON "ledger_entries" TO "authenticated";
GRANT INSERT ON "ledger_entries" TO "authenticated";
GRANT REFERENCES ON "ledger_entries" TO "neondb_owner" WITH GRANT OPTION;
GRANT INSERT ON "ledger_entries" TO "neondb_owner" WITH GRANT OPTION;
GRANT SELECT ON "ledger_entries" TO "neondb_owner" WITH GRANT OPTION;
GRANT UPDATE ON "ledger_entries" TO "neondb_owner" WITH GRANT OPTION;
GRANT DELETE ON "ledger_entries" TO "neondb_owner" WITH GRANT OPTION;
GRANT TRUNCATE ON "ledger_entries" TO "neondb_owner" WITH GRANT OPTION;
GRANT TRIGGER ON "ledger_entries" TO "neondb_owner" WITH GRANT OPTION;
GRANT SELECT ON "ledger_postings" TO "authenticated";
GRANT UPDATE ON "ledger_postings" TO "authenticated";
GRANT DELETE ON "ledger_postings" TO "authenticated";
GRANT INSERT ON "ledger_postings" TO "authenticated";
GRANT SELECT ON "ledger_postings" TO "neondb_owner" WITH GRANT OPTION;
GRANT INSERT ON "ledger_postings" TO "neondb_owner" WITH GRANT OPTION;
GRANT UPDATE ON "ledger_postings" TO "neondb_owner" WITH GRANT OPTION;
GRANT DELETE ON "ledger_postings" TO "neondb_owner" WITH GRANT OPTION;
GRANT TRUNCATE ON "ledger_postings" TO "neondb_owner" WITH GRANT OPTION;
GRANT REFERENCES ON "ledger_postings" TO "neondb_owner" WITH GRANT OPTION;
GRANT TRIGGER ON "ledger_postings" TO "neondb_owner" WITH GRANT OPTION;
GRANT DELETE ON "ledger_transactions" TO "authenticated";
GRANT INSERT ON "ledger_transactions" TO "authenticated";
GRANT SELECT ON "ledger_transactions" TO "authenticated";
GRANT UPDATE ON "ledger_transactions" TO "authenticated";
GRANT UPDATE ON "ledger_transactions" TO "neondb_owner" WITH GRANT OPTION;
GRANT DELETE ON "ledger_transactions" TO "neondb_owner" WITH GRANT OPTION;
GRANT TRUNCATE ON "ledger_transactions" TO "neondb_owner" WITH GRANT OPTION;
GRANT REFERENCES ON "ledger_transactions" TO "neondb_owner" WITH GRANT OPTION;
GRANT TRIGGER ON "ledger_transactions" TO "neondb_owner" WITH GRANT OPTION;
GRANT INSERT ON "ledger_transactions" TO "neondb_owner" WITH GRANT OPTION;
GRANT SELECT ON "ledger_transactions" TO "neondb_owner" WITH GRANT OPTION;
GRANT UPDATE ON "mpesa_payments" TO "authenticated";
GRANT DELETE ON "mpesa_payments" TO "authenticated";
GRANT INSERT ON "mpesa_payments" TO "authenticated";
GRANT SELECT ON "mpesa_payments" TO "authenticated";
GRANT INSERT ON "mpesa_payments" TO "neondb_owner" WITH GRANT OPTION;
GRANT SELECT ON "mpesa_payments" TO "neondb_owner" WITH GRANT OPTION;
GRANT UPDATE ON "mpesa_payments" TO "neondb_owner" WITH GRANT OPTION;
GRANT DELETE ON "mpesa_payments" TO "neondb_owner" WITH GRANT OPTION;
GRANT TRUNCATE ON "mpesa_payments" TO "neondb_owner" WITH GRANT OPTION;
GRANT REFERENCES ON "mpesa_payments" TO "neondb_owner" WITH GRANT OPTION;
GRANT TRIGGER ON "mpesa_payments" TO "neondb_owner" WITH GRANT OPTION;
GRANT DELETE ON "order_acceptances" TO "authenticated";
GRANT INSERT ON "order_acceptances" TO "authenticated";
GRANT SELECT ON "order_acceptances" TO "authenticated";
GRANT UPDATE ON "order_acceptances" TO "authenticated";
GRANT DELETE ON "order_acceptances" TO "neondb_owner" WITH GRANT OPTION;
GRANT TRUNCATE ON "order_acceptances" TO "neondb_owner" WITH GRANT OPTION;
GRANT REFERENCES ON "order_acceptances" TO "neondb_owner" WITH GRANT OPTION;
GRANT TRIGGER ON "order_acceptances" TO "neondb_owner" WITH GRANT OPTION;
GRANT INSERT ON "order_acceptances" TO "neondb_owner" WITH GRANT OPTION;
GRANT SELECT ON "order_acceptances" TO "neondb_owner" WITH GRANT OPTION;
GRANT UPDATE ON "order_acceptances" TO "neondb_owner" WITH GRANT OPTION;
GRANT INSERT ON "order_terms_versions" TO "authenticated";
GRANT DELETE ON "order_terms_versions" TO "authenticated";
GRANT UPDATE ON "order_terms_versions" TO "authenticated";
GRANT SELECT ON "order_terms_versions" TO "authenticated";
GRANT TRIGGER ON "order_terms_versions" TO "neondb_owner" WITH GRANT OPTION;
GRANT INSERT ON "order_terms_versions" TO "neondb_owner" WITH GRANT OPTION;
GRANT SELECT ON "order_terms_versions" TO "neondb_owner" WITH GRANT OPTION;
GRANT UPDATE ON "order_terms_versions" TO "neondb_owner" WITH GRANT OPTION;
GRANT DELETE ON "order_terms_versions" TO "neondb_owner" WITH GRANT OPTION;
GRANT TRUNCATE ON "order_terms_versions" TO "neondb_owner" WITH GRANT OPTION;
GRANT REFERENCES ON "order_terms_versions" TO "neondb_owner" WITH GRANT OPTION;
GRANT DELETE ON "orders" TO "authenticated";
GRANT INSERT ON "orders" TO "authenticated";
GRANT SELECT ON "orders" TO "authenticated";
GRANT UPDATE ON "orders" TO "authenticated";
GRANT DELETE ON "orders" TO "neondb_owner" WITH GRANT OPTION;
GRANT UPDATE ON "orders" TO "neondb_owner" WITH GRANT OPTION;
GRANT SELECT ON "orders" TO "neondb_owner" WITH GRANT OPTION;
GRANT INSERT ON "orders" TO "neondb_owner" WITH GRANT OPTION;
GRANT TRIGGER ON "orders" TO "neondb_owner" WITH GRANT OPTION;
GRANT REFERENCES ON "orders" TO "neondb_owner" WITH GRANT OPTION;
GRANT TRUNCATE ON "orders" TO "neondb_owner" WITH GRANT OPTION;
GRANT INSERT ON "refresh_tokens" TO "authenticated";
GRANT DELETE ON "refresh_tokens" TO "authenticated";
GRANT UPDATE ON "refresh_tokens" TO "authenticated";
GRANT SELECT ON "refresh_tokens" TO "authenticated";
GRANT SELECT ON "refresh_tokens" TO "neondb_owner" WITH GRANT OPTION;
GRANT TRIGGER ON "refresh_tokens" TO "neondb_owner" WITH GRANT OPTION;
GRANT REFERENCES ON "refresh_tokens" TO "neondb_owner" WITH GRANT OPTION;
GRANT TRUNCATE ON "refresh_tokens" TO "neondb_owner" WITH GRANT OPTION;
GRANT DELETE ON "refresh_tokens" TO "neondb_owner" WITH GRANT OPTION;
GRANT UPDATE ON "refresh_tokens" TO "neondb_owner" WITH GRANT OPTION;
GRANT INSERT ON "refresh_tokens" TO "neondb_owner" WITH GRANT OPTION;
GRANT INSERT ON "timers" TO "authenticated";
GRANT SELECT ON "timers" TO "authenticated";
GRANT UPDATE ON "timers" TO "authenticated";
GRANT DELETE ON "timers" TO "authenticated";
GRANT TRUNCATE ON "timers" TO "neondb_owner" WITH GRANT OPTION;
GRANT SELECT ON "timers" TO "neondb_owner" WITH GRANT OPTION;
GRANT TRIGGER ON "timers" TO "neondb_owner" WITH GRANT OPTION;
GRANT REFERENCES ON "timers" TO "neondb_owner" WITH GRANT OPTION;
GRANT INSERT ON "timers" TO "neondb_owner" WITH GRANT OPTION;
GRANT UPDATE ON "timers" TO "neondb_owner" WITH GRANT OPTION;
GRANT DELETE ON "timers" TO "neondb_owner" WITH GRANT OPTION;
GRANT SELECT ON "users" TO "authenticated";
GRANT DELETE ON "users" TO "authenticated";
GRANT UPDATE ON "users" TO "authenticated";
GRANT INSERT ON "users" TO "authenticated";
GRANT TRIGGER ON "users" TO "neondb_owner" WITH GRANT OPTION;
GRANT INSERT ON "users" TO "neondb_owner" WITH GRANT OPTION;
GRANT UPDATE ON "users" TO "neondb_owner" WITH GRANT OPTION;
GRANT DELETE ON "users" TO "neondb_owner" WITH GRANT OPTION;
GRANT TRUNCATE ON "users" TO "neondb_owner" WITH GRANT OPTION;
GRANT REFERENCES ON "users" TO "neondb_owner" WITH GRANT OPTION;
GRANT SELECT ON "users" TO "neondb_owner" WITH GRANT OPTION;
GRANT DELETE ON "wallets" TO "authenticated";
GRANT UPDATE ON "wallets" TO "authenticated";
GRANT SELECT ON "wallets" TO "authenticated";
GRANT INSERT ON "wallets" TO "authenticated";
GRANT REFERENCES ON "wallets" TO "neondb_owner" WITH GRANT OPTION;
GRANT TRIGGER ON "wallets" TO "neondb_owner" WITH GRANT OPTION;
GRANT INSERT ON "wallets" TO "neondb_owner" WITH GRANT OPTION;
GRANT SELECT ON "wallets" TO "neondb_owner" WITH GRANT OPTION;
GRANT UPDATE ON "wallets" TO "neondb_owner" WITH GRANT OPTION;
GRANT DELETE ON "wallets" TO "neondb_owner" WITH GRANT OPTION;
GRANT TRUNCATE ON "wallets" TO "neondb_owner" WITH GRANT OPTION;
GRANT INSERT ON "webhook_events" TO "authenticated";
GRANT SELECT ON "webhook_events" TO "authenticated";
GRANT UPDATE ON "webhook_events" TO "authenticated";
GRANT DELETE ON "webhook_events" TO "authenticated";
GRANT SELECT ON "webhook_events" TO "neondb_owner" WITH GRANT OPTION;
GRANT INSERT ON "webhook_events" TO "neondb_owner" WITH GRANT OPTION;
GRANT TRIGGER ON "webhook_events" TO "neondb_owner" WITH GRANT OPTION;
GRANT REFERENCES ON "webhook_events" TO "neondb_owner" WITH GRANT OPTION;
GRANT TRUNCATE ON "webhook_events" TO "neondb_owner" WITH GRANT OPTION;
GRANT DELETE ON "webhook_events" TO "neondb_owner" WITH GRANT OPTION;
GRANT UPDATE ON "webhook_events" TO "neondb_owner" WITH GRANT OPTION;
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"table_name" varchar(50) NOT NULL,
	"record_id" uuid,
	"action" varchar(30) NOT NULL,
	"actor_id" uuid,
	"old_values" jsonb,
	"new_values" jsonb,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
CREATE TABLE "dispute_evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"dispute_id" uuid NOT NULL,
	"uploaded_by" uuid NOT NULL,
	"description" text,
	"file_url" varchar(500),
	"created_at" timestamp DEFAULT now() NOT NULL
);
CREATE TABLE "disputes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"order_id" uuid NOT NULL,
	"opened_by" uuid NOT NULL,
	"reason" varchar(50) NOT NULL,
	"description" text NOT NULL,
	"status" varchar(20) DEFAULT 'OPEN' NOT NULL,
	"resolved_at" timestamp,
	"resolution" varchar(50),
	"resolved_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "dispute_resolution_check" CHECK (((resolution IS NULL) OR ((resolution)::text = ANY ((ARRAY['REFUND_PAYER'::character varying, 'RELEASE_PAYEE'::character varying, 'SPLIT'::character varying])::text[])))),
	CONSTRAINT "dispute_status_check" CHECK (((status)::text = ANY ((ARRAY['OPEN'::character varying, 'IN_REVIEW'::character varying, 'RESOLVED'::character varying, 'REJECTED'::character varying])::text[])))
);
CREATE TABLE "ledger_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"account_code" varchar(60) NOT NULL,
	"account_name" varchar(120) NOT NULL,
	"account_type" varchar(20) NOT NULL,
	"currency" char(3) DEFAULT 'KES' NOT NULL,
	"owner_user_id" uuid,
	"order_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ledger_account_scope_check" CHECK (((((account_code)::text = ANY ((ARRAY['USER_WALLET_AVAILABLE'::character varying, 'USER_WALLET_HELD'::character varying])::text[])) AND (owner_user_id IS NOT NULL) AND (order_id IS NULL)) OR (((account_code)::text = 'ORDER_ESCROW'::text) AND (owner_user_id IS NULL) AND (order_id IS NOT NULL)) OR (((account_code)::text <> ALL ((ARRAY['USER_WALLET_AVAILABLE'::character varying, 'USER_WALLET_HELD'::character varying, 'ORDER_ESCROW'::character varying])::text[])) AND (owner_user_id IS NULL) AND (order_id IS NULL)))),
	CONSTRAINT "ledger_account_type_check" CHECK (((account_type)::text = ANY ((ARRAY['ASSET'::character varying, 'LIABILITY'::character varying, 'EQUITY'::character varying, 'REVENUE'::character varying, 'EXPENSE'::character varying])::text[])))
);
CREATE TABLE "ledger_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"transaction_id" uuid NOT NULL,
	"order_id" uuid,
	"from_account" varchar(50) NOT NULL,
	"to_account" varchar(50) NOT NULL,
	"amount_cents" bigint NOT NULL,
	"reason" varchar(100) NOT NULL,
	"ref_type" varchar(30),
	"ref_id" varchar(100),
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "amount_positive" CHECK ((amount_cents > 0))
);
CREATE TABLE "ledger_postings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"transaction_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"debit_cents" bigint DEFAULT 0 NOT NULL,
	"credit_cents" bigint DEFAULT 0 NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ledger_posting_amount_check" CHECK ((((debit_cents > 0) AND (credit_cents = 0)) OR ((credit_cents > 0) AND (debit_cents = 0))))
);
CREATE TABLE "ledger_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"idempotency_key" varchar(200) NOT NULL CONSTRAINT "ledger_transactions_idempotency_key_key" UNIQUE,
	"transaction_type" varchar(50) NOT NULL,
	"description" text,
	"order_id" uuid,
	"payment_id" uuid,
	"currency" char(3) DEFAULT 'KES' NOT NULL,
	"reverses_transaction_id" uuid,
	"created_by" uuid,
	"posted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ledger_transaction_type_check" CHECK (((transaction_type)::text = ANY ((ARRAY['MPESA_DEPOSIT'::character varying, 'WALLET_TRANSFER'::character varying, 'ESCROW_FUNDING'::character varying, 'ESCROW_RELEASE'::character varying, 'ESCROW_REFUND'::character varying, 'PLATFORM_FEE'::character varying, 'SELLER_PAYOUT'::character varying, 'WALLET_WITHDRAWAL'::character varying, 'MANUAL_ADJUSTMENT'::character varying, 'REVERSAL'::character varying])::text[])))
);
CREATE TABLE "mpesa_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"order_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"type" varchar(20) NOT NULL,
	"direction" varchar(10) NOT NULL,
	"amount_cents" bigint NOT NULL,
	"checkout_request_id" varchar(100),
	"mpesa_receipt_number" varchar(100),
	"conversation_id" varchar(100),
	"originator_conversation_id" varchar(100),
	"result_code" integer,
	"result_desc" text,
	"raw_callback" jsonb,
	"status" varchar(20) DEFAULT 'PENDING' NOT NULL,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"next_retry_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "mpesa_amount_check" CHECK ((amount_cents > 0)),
	CONSTRAINT "mpesa_retry_check" CHECK ((retry_count >= 0))
);
CREATE TABLE "order_acceptances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"order_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"terms_version" integer NOT NULL,
	"accepted_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "order_user_terms_acceptance" UNIQUE("order_id","user_id","terms_version")
);
CREATE TABLE "order_terms_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"order_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"hash" varchar(64) NOT NULL,
	"price_cents" bigint NOT NULL,
	"callout_fee_cents" bigint DEFAULT 0 NOT NULL,
	"scope_description" text NOT NULL,
	"delivery_mode" varchar(20) NOT NULL,
	"extra_terms" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "order_terms_unique" UNIQUE("order_id","version"),
	CONSTRAINT "terms_price_check" CHECK (((price_cents > 0) AND (callout_fee_cents >= 0)))
);
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"payer_id" uuid NOT NULL,
	"payee_id" uuid NOT NULL,
	"state" varchar(30) DEFAULT 'DRAFT' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"terms_version" integer DEFAULT 0 NOT NULL,
	"current_terms_hash" varchar(64),
	"price_cents" bigint,
	"fee_cents" bigint,
	"callout_fee_cents" bigint DEFAULT 0,
	"delivery_mode" varchar(20),
	"delivery_proof_hash" varchar(64),
	"funding_deadline" timestamp,
	"review_deadline" timestamp,
	"paid_at" timestamp,
	"released_at" timestamp,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "order_fee_check" CHECK ((((fee_cents IS NULL) OR (fee_cents >= 0)) AND ((callout_fee_cents IS NULL) OR (callout_fee_cents >= 0)))),
	CONSTRAINT "order_participants_check" CHECK ((payer_id <> payee_id)),
	CONSTRAINT "order_price_check" CHECK (((price_cents IS NULL) OR (price_cents > 0)))
);
CREATE TABLE "refresh_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL CONSTRAINT "refresh_tokens_token_hash_key" UNIQUE,
	"family_id" uuid NOT NULL,
	"expires_at" timestamp NOT NULL,
	"revoked_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
CREATE TABLE "timers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"order_id" uuid NOT NULL CONSTRAINT "timers_order_id_key" UNIQUE,
	"timer_type" varchar(30) NOT NULL,
	"fire_at" timestamp NOT NULL,
	"fired_at" timestamp,
	"action" varchar(50) NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "timer_type_check" CHECK (((timer_type)::text = ANY ((ARRAY['FUNDING_WINDOW'::character varying, 'REVIEW_WINDOW'::character varying, 'PAYOUT_RETRY'::character varying, 'NO_SHOW'::character varying])::text[])))
);
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"phone" varchar(14) NOT NULL CONSTRAINT "users_phone_key" UNIQUE,
	"password_hash" text NOT NULL,
	"display_name" varchar(100) NOT NULL,
	"role" varchar(20) DEFAULT 'user' NOT NULL,
	"kyc_tier" integer DEFAULT 0 NOT NULL,
	"kyc_id_number" varchar(20),
	"kyc_verified_at" timestamp,
	"failed_login_attempts" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "kyc_tier_check" CHECK ((kyc_tier = ANY (ARRAY[0, 1, 2]))),
	CONSTRAINT "role_check" CHECK (((role)::text = ANY ((ARRAY['user'::character varying, 'support'::character varying, 'admin'::character varying])::text[])))
);
CREATE TABLE "wallets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid NOT NULL CONSTRAINT "wallets_user_id_key" UNIQUE,
	"balance" bigint DEFAULT 0 NOT NULL,
	"held_balance" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "balance_non_negative" CHECK ((balance >= 0)),
	CONSTRAINT "held_balance_non_negative" CHECK ((held_balance >= 0)),
	CONSTRAINT "wallet_balance_check" CHECK (((balance >= 0) AND (held_balance >= 0)))
);
CREATE TABLE "webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"source" varchar(50) NOT NULL,
	"idempotency_key" varchar(200) NOT NULL CONSTRAINT "webhook_events_idempotency_key_key" UNIQUE,
	"order_id" uuid,
	"event_type" varchar(50) NOT NULL,
	"raw_body" jsonb,
	"processed_at" timestamp,
	"error" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX "audit_log_created_idx" ON "audit_log" ("created_at");
CREATE UNIQUE INDEX "audit_log_pkey" ON "audit_log" ("id");
CREATE INDEX "audit_log_record_idx" ON "audit_log" ("table_name","record_id");
CREATE INDEX "dispute_evidence_dispute_idx" ON "dispute_evidence" ("dispute_id");
CREATE UNIQUE INDEX "dispute_evidence_pkey" ON "dispute_evidence" ("id");
CREATE INDEX "disputes_opened_by_idx" ON "disputes" ("opened_by");
CREATE INDEX "disputes_order_idx" ON "disputes" ("order_id");
CREATE UNIQUE INDEX "disputes_pkey" ON "disputes" ("id");
CREATE UNIQUE INDEX "ledger_accounts_pkey" ON "ledger_accounts" ("id");
CREATE UNIQUE INDEX "ledger_order_account_unique" ON "ledger_accounts" ("order_id","account_code","currency");
CREATE UNIQUE INDEX "ledger_platform_account_unique" ON "ledger_accounts" ("account_code","currency");
CREATE UNIQUE INDEX "ledger_user_account_unique" ON "ledger_accounts" ("owner_user_id","account_code","currency");
CREATE UNIQUE INDEX "ledger_entries_pkey" ON "ledger_entries" ("id");
CREATE INDEX "ledger_order_idx" ON "ledger_entries" ("order_id");
CREATE INDEX "ledger_transaction_idx" ON "ledger_entries" ("transaction_id");
CREATE INDEX "ledger_postings_account_idx" ON "ledger_postings" ("account_id");
CREATE UNIQUE INDEX "ledger_postings_pkey" ON "ledger_postings" ("id");
CREATE INDEX "ledger_postings_transaction_idx" ON "ledger_postings" ("transaction_id");
CREATE UNIQUE INDEX "ledger_reversal_unique" ON "ledger_transactions" ("reverses_transaction_id");
CREATE INDEX "ledger_transactions_created_idx" ON "ledger_transactions" ("created_at");
CREATE UNIQUE INDEX "ledger_transactions_idempotency_key_key" ON "ledger_transactions" ("idempotency_key");
CREATE INDEX "ledger_transactions_order_idx" ON "ledger_transactions" ("order_id");
CREATE INDEX "ledger_transactions_payment_idx" ON "ledger_transactions" ("payment_id");
CREATE UNIQUE INDEX "ledger_transactions_pkey" ON "ledger_transactions" ("id");
CREATE INDEX "mpesa_checkout_req_idx" ON "mpesa_payments" ("checkout_request_id");
CREATE INDEX "mpesa_order_idx" ON "mpesa_payments" ("order_id");
CREATE UNIQUE INDEX "mpesa_payments_pkey" ON "mpesa_payments" ("id");
CREATE UNIQUE INDEX "mpesa_receipt_unique" ON "mpesa_payments" ("mpesa_receipt_number");
CREATE INDEX "mpesa_user_idx" ON "mpesa_payments" ("user_id");
CREATE UNIQUE INDEX "order_acceptances_pkey" ON "order_acceptances" ("id");
CREATE INDEX "order_acceptances_user_idx" ON "order_acceptances" ("user_id");
CREATE UNIQUE INDEX "order_user_terms_acceptance" ON "order_acceptances" ("order_id","user_id","terms_version");
CREATE UNIQUE INDEX "order_terms_unique" ON "order_terms_versions" ("order_id","version");
CREATE UNIQUE INDEX "order_terms_versions_pkey" ON "order_terms_versions" ("id");
CREATE INDEX "orders_payee_idx" ON "orders" ("payee_id");
CREATE INDEX "orders_payer_idx" ON "orders" ("payer_id");
CREATE UNIQUE INDEX "orders_pkey" ON "orders" ("id");
CREATE INDEX "orders_state_idx" ON "orders" ("state");
CREATE INDEX "refresh_tokens_family_idx" ON "refresh_tokens" ("family_id");
CREATE UNIQUE INDEX "refresh_tokens_pkey" ON "refresh_tokens" ("id");
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens" ("token_hash");
CREATE INDEX "refresh_tokens_user_idx" ON "refresh_tokens" ("user_id");
CREATE INDEX "timers_fire_idx" ON "timers" ("fire_at","fired_at");
CREATE UNIQUE INDEX "timers_order_id_key" ON "timers" ("order_id");
CREATE UNIQUE INDEX "timers_pkey" ON "timers" ("id");
CREATE UNIQUE INDEX "users_phone_key" ON "users" ("phone");
CREATE UNIQUE INDEX "users_pkey" ON "users" ("id");
CREATE UNIQUE INDEX "wallets_pkey" ON "wallets" ("id");
CREATE UNIQUE INDEX "wallets_user_id_key" ON "wallets" ("user_id");
CREATE UNIQUE INDEX "webhook_events_idempotency_key_key" ON "webhook_events" ("idempotency_key");
CREATE UNIQUE INDEX "webhook_events_pkey" ON "webhook_events" ("id");
CREATE INDEX "webhook_order_idx" ON "webhook_events" ("order_id");
CREATE INDEX "webhook_unprocessed_idx" ON "webhook_events" ("created_at");
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id");
ALTER TABLE "dispute_evidence" ADD CONSTRAINT "dispute_evidence_dispute_id_fkey" FOREIGN KEY ("dispute_id") REFERENCES "disputes"("id") ON DELETE CASCADE;
ALTER TABLE "dispute_evidence" ADD CONSTRAINT "dispute_evidence_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id");
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_opened_by_fkey" FOREIGN KEY ("opened_by") REFERENCES "users"("id");
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id");
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "users"("id");
ALTER TABLE "ledger_accounts" ADD CONSTRAINT "ledger_accounts_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id");
ALTER TABLE "ledger_accounts" ADD CONSTRAINT "ledger_accounts_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id");
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id");
ALTER TABLE "ledger_postings" ADD CONSTRAINT "ledger_postings_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "ledger_accounts"("id");
ALTER TABLE "ledger_postings" ADD CONSTRAINT "ledger_postings_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "ledger_transactions"("id");
ALTER TABLE "ledger_transactions" ADD CONSTRAINT "ledger_transactions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id");
ALTER TABLE "ledger_transactions" ADD CONSTRAINT "ledger_transactions_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id");
ALTER TABLE "ledger_transactions" ADD CONSTRAINT "ledger_transactions_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "mpesa_payments"("id");
ALTER TABLE "ledger_transactions" ADD CONSTRAINT "ledger_transactions_reverses_transaction_id_fkey" FOREIGN KEY ("reverses_transaction_id") REFERENCES "ledger_transactions"("id");
ALTER TABLE "mpesa_payments" ADD CONSTRAINT "mpesa_payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id");
ALTER TABLE "mpesa_payments" ADD CONSTRAINT "mpesa_payments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id");
ALTER TABLE "order_acceptances" ADD CONSTRAINT "order_acceptances_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE;
ALTER TABLE "order_acceptances" ADD CONSTRAINT "order_acceptances_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id");
ALTER TABLE "order_terms_versions" ADD CONSTRAINT "order_terms_versions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id");
ALTER TABLE "order_terms_versions" ADD CONSTRAINT "order_terms_versions_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE;
ALTER TABLE "orders" ADD CONSTRAINT "orders_payee_id_fkey" FOREIGN KEY ("payee_id") REFERENCES "users"("id");
ALTER TABLE "orders" ADD CONSTRAINT "orders_payer_id_fkey" FOREIGN KEY ("payer_id") REFERENCES "users"("id");
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
ALTER TABLE "timers" ADD CONSTRAINT "timers_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id");
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
ALTER TABLE "webhook_events" ADD CONSTRAINT "webhook_events_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id");