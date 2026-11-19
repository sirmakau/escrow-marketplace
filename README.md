# Escrow Marketplace — Backend

A production-shaped **Node.js + Express + TypeScript** backend for a generic escrow marketplace. Two people (payer and payee) transact; money is held until both sides' gates are satisfied. Roles belong to the **ORDER**, not the account.

## Architecture

```
routes → controllers (= routes + services) → repositories → Neon (Postgres)
```

```
server/src/
├── config/          # Environment validation with Zod
├── middleware/       # request-id, pino-http, helmet, cors, rate-limit,
│                    # validate, authenticate, authorize, requireOrderParty,
│                    # idempotency, errorHandler
├── modules/
│   ├── auth/        # register, login, refresh, logout (JWT + argon2)
│   ├── users/       # profiles, KYC, wallets
│   ├── orders/      # state machine, terms versioning, acceptances
│   ├── payments/    # STK Push, callback handling, release, refund
│   ├── ledger/      # double-entry append-only bookkeeping
│   ├── disputes/    # open, evidence, resolve
│   ├── admin/       # dashboard, ledger view, audit log, force state
│   └── events/      # SSE realtime per-order updates
├── integrations/
│   └── mpesa/       # Daraja (mock | sandbox | production) adapter
├── workers/         # Timer polling, reconciliation, auto-release
├── db/
│   ├── schema/      # Drizzle ORM schema (16 tables)
│   ├── migrations/  # Generated migrations
│   ├── client.ts    # DB connection & helpers
│   └── seed.ts      # Test users + wallets
├── utils/           # AppError, logger, maskPII, helpers, params
├── demo/            # Concurrency demo script
└── index.ts         # Express app entry point
```

## Order State Machine

| Current | Actor | Next State | Notes |
|---------|-------|-----------|-------|
| DRAFT | payee | PROPOSED | |
| PROPOSED | payer | ACCEPTED | |
| ACCEPTED | system | FUNDED | After M-Pesa callback |
| FUNDED | payer | IN_PROGRESS | In-person check-in |
| FUNDED | payee | IN_PROGRESS | Digital delivery |
| IN_PROGRESS | payee | DELIVERED | |
| DELIVERED | payer | COMPLETED | |
| COMPLETED | system | RELEASED | Timer or approval |
| * | payer/payee | DISPUTED | Funded+ states |
| DRAFT | payee | CANCELLED | |
| PROPOSED/ACCEPTED | payer | CANCELLED | |
| DISPUTED | support | REFUNDED | |
| DISPUTED | support | RELEASED | |

**Invalid transitions → 409 Conflict** with the reason.

## Concurrency (Core Requirement)

Every state-changing operation runs inside a DB transaction that starts with:

```sql
SELECT ... FROM orders WHERE id = $1 FOR UPDATE
```

This **serialises** payer and payee actions across multiple server instances. Key guarantees:

1. **Terms versioning**: `PAYEE` sets terms v2 while `PAYER` accepts v1 → one gets 409 (stale version).
2. **Duplicate payment callbacks**: Unique constraint on `mpesa_receipt_number` + idempotency key lookup → exactly one ledger entry.
3. **Double release race**: Two actors (payer approval + timer) both `SELECT ... FOR UPDATE`; first one transitions `COMPLETED → RELEASED`, second sees wrong state → 409.
4. **Dispute vs timer**: Dispute sets `COMPLETED → DISPUTED`, timer sees `DISPUTED` not `COMPLETED` → can't release.
5. **Audit log**: Every state change writes an `audit_log` row **in the same DB transaction**.

## M-Pesa Daraja Integration

### Mock Mode (`MPESA_MODE=mock`)
- **No credentials needed**. Works offline.
- In-memory fake that accepts STK Push requests and fires callbacks after 2 seconds.
- Simulates success, failure, and duplicate callbacks.

### Sandbox Mode (`MPESA_MODE=sandbox`)
- Uses `https://sandbox.safaricom.co.ke`
- Requires sandbox credentials from [Safaricom Developer Portal](https://developer.safaricom.co.ke/)
- **Callback URLs must be public HTTPS**. During development, use:
  ```bash
  ngrok http 3000
  # or
  cloudflared tunnel --url http://localhost:3000
  ```
  Set `MPESA_CALLBACK_BASE_URL` to your ngrok/cloudflared URL.

### Production Mode (`MPESA_MODE=production`)
- Uses `https://api.safaricom.co.ke`
- Production shortcode, passkey, and signed certificate required.
- Change just the env var — no code changes.

### STK Push Flow

```
PAYER → POST /api/payments/fund/:orderId
         → initiateFunding()
           → Daraja.stkPush()
             → M-Pesa sends STK prompt to payer's phone
             → M-Pesa POSTs to /api/payments/mpesa/stk-callback
               → handleStkCallback()
                 → verify CheckoutRequestID matches pending payment
                 → deduplicate on MpesaReceiptNumber
                 → create ledger entry (payer → mpesa_float)
                 → transition order ACCEPTED → FUNDED
                 → schedule review deadline timer
```

### B2C Payout Flow

```
SYSTEM → releasePayment()
         → double-entry ledger (mpesa_float → platform_revenue, payee)
         → Daraja.b2c()
           → M-Pesa sends money to payee's M-Pesa
           → POSTs to /api/payments/mpesa/b2c-callback
```

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL (Neon or local)
- npm

The repository has two independent packages, each with its own `package.json`,
`node_modules` and `.env`:

```
client/   React + Vite application (:5173)
server/   Express API, workers, migrations (:3000)
```

### Setup

Server (first terminal):

```bash
cd server
npm install
cp .env.example .env     # Edit DATABASE_URL, JWT secrets, M-Pesa settings
npm run migrate          # Push schema to database
npm run seed             # Create test users
npm run dev              # API on :3000 (tsx watch)
```

Client (second terminal):

```bash
cd client
npm install
cp .env.example .env     # VITE_API_BASE_URL can stay empty for the dev proxy
npm run dev              # App on :5173
```

### Test Users (after seed)

| Role | Phone | Password |
|------|-------|----------|
| Admin | +254700000001 | password123 |
| Support | +254700000002 | password123 |
| Payer (Alice) | +254712345678 | password123 |
| Payee (Bob) | +254798765432 | password123 |

### Running

In `server/`:

```bash
npm run dev          # API server on :3000
npm run worker       # Background worker process
npm run demo         # Concurrency demo (service-layer + transition table)
npm run migrate      # Push the Drizzle schema
npm run seed         # Create the test users
npm run test         # Unit tests (21 passing)
npm run build        # Compile TypeScript to server/dist
```

In `client/`:

```bash
npm run dev          # Vite dev server on :5173 (proxies /api and /health)
npm run build        # Production bundle in client/dist
npm run preview      # Preview the built bundle
npm run typecheck    # TypeScript check
```

### Frontend

The application is a React + Vite client in `client/` with role-aware navigation:
dashboard, escrows, guided create flow, escrow details with timeline and M-Pesa
funding, wallet, transactions, disputes, notifications, profile/verification,
help, and an admin workspace (users, disputes, ledger, audit log).

Run `server` and `client` independently. In development, open http://localhost:5173.
In production, `cd client && npm run build` writes the bundle to `client/dist`,
which the Express server serves directly (with SPA fallback) at http://localhost:3000.

Each app has its own env file: `server/.env` (database, JWT, M-Pesa) and
`client/.env` (only public `VITE_*` values, such as `VITE_API_BASE_URL`).
For local development, leave `VITE_API_BASE_URL` empty so Vite proxies `/api`
to `http://localhost:3000`. For a separately deployed Vercel frontend, set it
to the Render **backend** origin (for example,
`https://escrow-marketplace-8ndh.onrender.com`), not to the Vercel frontend
URL itself.

### Deploying the frontend on Vercel

Create a Vercel project with `client/` as its root directory and set this
Production environment variable:

```text
VITE_API_BASE_URL=https://escrow-marketplace-8ndh.onrender.com
```

Set the same Vercel site URL in the Render service's `CORS_ORIGINS` value.
The `client/vercel.json` rewrite keeps React Router routes working when a
deployed page is refreshed directly.

### API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /api/auth/register | No | Register new user |
| POST | /api/auth/login | No | Login |
| POST | /api/auth/refresh | No | Refresh JWT |
| POST | /api/auth/logout | JWT | Logout |
| GET | /api/users/me | JWT | Current user + wallet |
| POST | /api/orders | JWT+KYC1 | Create order (payee) |
| GET | /api/orders | JWT | List my orders |
| GET | /api/orders/:id | JWT | Get order details |
| PUT | /api/orders/:id/terms | JWT | Set terms (payee) |
| POST | /api/orders/:id/propose | JWT | Propose (payee) |
| POST | /api/orders/:id/accept | JWT | Accept terms (payer) |
| POST | /api/orders/:id/cancel | JWT | Cancel |
| POST | /api/payments/fund/:id | JWT | STK Push (payer) |
| POST | /api/payments/release/:id | JWT | Release (payer) |
| POST | /api/payments/mpesa/stk-callback | Public | M-Pesa callback |
| POST | /api/payments/mpesa/b2c-callback | Public | B2C callback |
| POST | /api/disputes/:orderId | JWT | Open dispute |
| POST | /api/disputes/:id/resolve | Admin | Resolve dispute |
| GET | /api/events/orders/:id | JWT | SSE stream |
| GET | /api/admin/dashboard | Admin | Stats |
| GET | /health | No | Health check |

## Security

- **Parameterised queries** — no SQL injection
- **Secrets never logged** — `maskPII()` strips phone digits and password fields
- **Rate limits** ��� strict on auth (10/15min) and payment (5/min) routes
- **Account lockout** — after 5 failed logins, locked 15 minutes
- **Refresh token rotation** — each refresh issues a new token; old one revoked
- **KYC gating** — tier 0 = registration only, tier 1 = order creation
- **Order party enforcement** — roles derived from DB, never from JWT payload

## Deploying the Backend on Render

The repository includes a `render.yaml` blueprint for the API (`rootDir: server`,
health check at `/health`). Both M-Pesa credential sets live in the same service,
so going live is a single variable change.

1. In Render, choose **New → Blueprint**, connect this repository, and apply
   `render.yaml`.
2. Fill the prompted values:
   - `DATABASE_URL` — your Neon pooled connection string (`sslmode=require`)
   - `CORS_ORIGINS` — the deployed client origin(s), comma-separated
   - `MPESA_MODE` — `sandbox`
   - `MPESA_CALLBACK_BASE_URL` — `https://<your-service>.onrender.com`
   - `MPESA_SANDBOX_*` — keys, shortcode, passkey and initiator credentials
     from the [Safaricom Developer Portal](https://developer.safaricom.co.ke/)
3. Deploy and confirm `https://<your-service>.onrender.com/health` returns
   `{"status":"ok","mode":"sandbox"}`.
4. Run the schema migration once against the production database:
   ```bash
   cd server
   DATABASE_URL='postgresql://...' npm run migrate
   ```

Production credentials can be entered now under `MPESA_PRODUCTION_*`; they are
ignored while `MPESA_MODE=sandbox`. When sandbox testing passes, change
`MPESA_MODE` to `production` in the Render dashboard and redeploy. If the
released product has no B2C initiator credentials or certificate yet, fill
`MPESA_PRODUCTION_INITIATOR_*` and `MPESA_PRODUCTION_CERT_PEM` (PEM contents;
`\n` escapes are accepted) before switching.

For production Daraja traffic, set these Render variables before deploying:

```text
MPESA_MODE=production
MPESA_CALLBACK_BASE_URL=https://escrow-marketplace-8ndh.onrender.com
MPESA_PRODUCTION_CONSUMER_KEY=...
MPESA_PRODUCTION_CONSUMER_SECRET=...
MPESA_PRODUCTION_SHORTCODE=...
MPESA_PRODUCTION_PASSKEY=...
```

Keep the credential values in Render's environment settings or another secret
manager; do not commit them to `.env` files or source control. The server
selects `MPESA_PRODUCTION_*` only when `MPESA_MODE=production`.

Each environment still needs a public HTTPS callback URL. If sandbox and
production run as separate Render services, set `MPESA_CALLBACK_BASE_URL` to each
service's own URL. Production certificate encryption uses
`MPESA_PRODUCTION_CERT_PEM` when set, otherwise `MPESA_PRODUCTION_CERT_PATH`.

Auto-release timers run in `server/src/workers/index.ts`, which is a separate
process. On Render, add a background worker with start command
`node dist/workers/index.js` and the same environment variables; free web
services also sleep when idle, which can delay M-Pesa callbacks.

## Moving to Production

1. Set `MPESA_MODE=production`
2. Ensure `MPESA_CALLBACK_BASE_URL` is your public HTTPS domain
3. Upload your Safaricom production certificate to `certs/safaricom.cer`
4. Set long random `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET`
5. Set `NODE_ENV=production`
6. Build both apps: `cd client && npm run build`, then `cd ../server && npm run build`
7. Start the API with `npm start` from `server/` (it serves `client/dist`)
8. Run the worker as a separate process: `node server/dist/workers/index.js`

## License

MIT
