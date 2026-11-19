/**
 * Escrow Marketplace — Express Application
 *
 * Middleware order:
 *   request-id → pino-http → helmet → cors → rate-limit → json/raw body → routes → error handler
 */

import express from 'express';
import pinoHttp from 'pino-http';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config/index.js';
import { logger, maskPII } from './utils/helpers.js';
import { requestIdMiddleware } from './middleware/requestId.js';
import { errorHandler } from './middleware/errorHandler.js';
import { getDaraja } from './integrations/mpesa/daraja.js';
import { handleStkCallback } from './modules/payments/payments.service.js';

// Route modules
import authRoutes from './modules/auth/auth.routes.js';
import usersRoutes from './modules/users/users.routes.js';
import orderRoutes from './modules/orders/orders.routes.js';
import paymentRoutes from './modules/payments/payments.routes.js';
import disputeRoutes from './modules/disputes/disputes.routes.js';
import adminRoutes from './modules/admin/admin.routes.js';
import eventRoutes from './modules/events/events.routes.js';

const app = express();

// ─── Middleware ────────────────────────────────────────────────────────────

// 1. Request ID
app.use(requestIdMiddleware);

// 2. Pino HTTP logger (PII masked)
app.use(pinoHttp({
  logger,
  serializers: {
    req: (req) => maskPII({ method: req.method, url: req.url, headers: req.headers }) as any,
    res: (res) => ({ statusCode: res.statusCode }),
  },
}));

// 3. Helmet
app.use(helmet());

// 4. CORS
app.use(cors({
  origin: config.CORS_ORIGINS,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key', 'X-Request-Id'],
}));

// 5. Front end (served before the API rate limiter so page loads don't
//    consume the 100-request budget). The React build from `client/dist` wins
//    when present; the legacy static console in `public/` is the fallback.
const projectRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const clientDist = path.join(projectRoot, 'client', 'dist');
const clientIndex = path.join(clientDist, 'index.html');
const clientBuilt = fs.existsSync(clientIndex);
app.use(express.static(clientBuilt ? clientDist : path.join(projectRoot, 'public')));

// 6. Rate limiting
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many requests, try later' } },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many auth attempts' } },
});

const paymentLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many payment requests' } },
});

app.use(globalLimiter);

// 7. JSON body parser — keep raw body for webhook verification
app.use(express.json({
  verify: (req: any, _res, buf: Buffer) => {
    req.rawBody = buf;
  },
}));

// 8. Routes (apply stricter limits to auth and payment)
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/payments', paymentLimiter, paymentRoutes);
app.use('/api/disputes', disputeRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/events', eventRoutes);

// 9. Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', mode: config.MPESA_MODE, time: new Date().toISOString() });
});

// 10. SPA fallback for the React client (client-side routes -> index.html)
if (clientBuilt) {
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api') || req.path === '/health') {
      return next();
    }
    res.sendFile(clientIndex);
  });
}

// 11. Error handler (must be last)
app.use(errorHandler);

// In mock mode the fake Daraja adapter emits callbacks in-process. Deliver
// them to the same handler the HTTP callback route uses.
if (config.isMock) {
  getDaraja().onStkCallback((callback) => {
    handleStkCallback(callback).catch((err) => {
      logger.error({ err: err.message }, 'Mock STK callback failed');
    });
  });
}

export { app };

// ─── Start server (only when run directly, not in tests) ──────────────────
const isDirectRun = process.argv[1]?.includes('index');
if (isDirectRun) {
  app.listen(config.PORT, () => {
    logger.info({
      port: config.PORT,
      mode: config.MPESA_MODE,
      env: config.NODE_ENV,
    }, 'Escrow marketplace API started');
  });
}