import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { idempotencyMiddleware } from '../../middleware/idempotency.js';
import { param } from '../../utils/params.js';
import * as paymentsService from './payments.service.js';
import { logger } from '../../utils/helpers.js';

const router = Router();

// ─── STK Push (payer funds the order) ────────────────────────────────────
router.post(
  '/fund/:orderId',
  authenticate,
  idempotencyMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await paymentsService.initiateFunding(param(req, 'orderId'), req.user!.id);
      res.json({ data: result });
    } catch (err) { next(err); }
  },
);

router.post(
  '/reconcile/:orderId',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await paymentsService.reconcileFunding(param(req, 'orderId'), req.user!.id);
      res.json({ data: result });
    } catch (err) { next(err); }
  },
);

// ─── STK Callback (public, no JWT) ───────────────────────────────────────
router.post('/mpesa/stk-callback', async (req: Request, res: Response, next: NextFunction) => {
  try {
    logger.info({ body: req.body }, 'STK callback received');

    // Safaricom wraps callback in { Body: { stkCallback: {...} } }
    const callback = req.body?.Body?.stkCallback || req.body;
    await paymentsService.handleStkCallback(callback);

    // Always respond with success to Safaricom
    res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  } catch (err) {
    logger.error({ err }, 'Error handling STK callback');
    res.json({ ResultCode: 0, ResultDesc: 'Accepted' }); // Acknowledge regardless
  }
});

// ─── B2C Callback (public) ───────────────────────────────────────────────
router.post('/mpesa/b2c-callback', async (req: Request, res: Response, next: NextFunction) => {
  try {
    logger.info({ body: req.body }, 'B2C callback received');
    res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  } catch (err) {
    res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  }
});

router.post('/mpesa/b2c-timeout', async (req: Request, res: Response, next: NextFunction) => {
  logger.warn({ body: req.body }, 'B2C timeout received');
  res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
});

// ─── Release payment (payer approves) ─────────────────────────────────────
router.post('/release/:orderId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await paymentsService.releasePayment(param(req, 'orderId'), req.user!.id);
    res.json({ data: result });
  } catch (err) { next(err); }
});

export default router;