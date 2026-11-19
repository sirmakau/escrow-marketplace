# Escrow Marketplace — Backend

A production-shaped **Node.js + Express + TypeScript** backend for a generic escrow marketplace. Two people (payer and payee) transact; money is held until both sides' gates are satisfied. Roles belong to the **ORDER**, not the account.

## Architecture

```
routes → controllers (= routes + services) → repositories → Neon (Postgres)
```

```
src/
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

### Setup

```bash
git clone <repo>
cd escrow-marketplace

cp .env.example .env
# Edit .env with your values (DATABASE_URL, secrets, etc.)

npm install
npm run migrate    # Push schema to database
npm run seed       # Create test users
npm run dev        # Start development server (tsx watch)
```

### Test Users (after seed)

| Role | Phone | Password |
|------|-------|----------|
| Admin | +254700000001 | password123 |
| Support | +254700000002 | password123 |
| Payer (Alice) | +254712345678 | password123 |
| Payee (Bob) | +254798765432 | password123 |

### Running

```bash
npm run dev          # API server on :3000
npm run dev:client   # React test console on :5173 (proxies /api to :3000)
npm run worker       # Background worker process
npm run demo         # Concurrency demo (service-layer + transition table)
npm run test         # Unit tests (21 passing)
npm run test:watch   # Watch mode
npm run build        # Build the client and compile the server
```

### Frontend

The test console is a React + Vite app in `client/`. In development, run
`npm run dev` and `npm run dev:client` together and open http://localhost:5173.
In production, `npm run build` writes the bundle to `client/dist`, which the
Express server serves directly (with SPA fallback) at http://localhost:3000.

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

## Moving to Production

1. Set `MPESA_MODE=production`
2. Ensure `MPESA_CALLBACK_BASE_URL` is your public HTTPS domain
3. Upload your Safaricom production certificate to `certs/safaricom.cer`
4. Set long random `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET`
5. Set `NODE_ENV=production`
6. Run `npm run build` and start with `node dist/index.js`
7. Run the worker as a separate process: `node dist/workers/index.js`

## License

MIT
