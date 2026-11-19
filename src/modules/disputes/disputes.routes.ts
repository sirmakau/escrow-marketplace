import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import { z } from 'zod';
import { param, queryInt } from '../../utils/params.js';
import * as disputesService from './disputes.service.js';
import { refundPayer, releasePayment } from '../payments/payments.service.js';

const router = Router();

const openDisputeSchema = z.object({
  reason: z.string().min(1).max(50),
  description: z.string().min(1).max(5000),
});

const resolveDisputeSchema = z.object({
  resolution: z.enum(['REFUND_PAYER', 'RELEASE_PAYEE', 'SPLIT']),
  notes: z.string().max(2000).optional(),
});

// Open a dispute (any party)
router.post(
  '/:orderId',
  authenticate,
  validate(openDisputeSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dispute = await disputesService.openDispute(
        param(req, 'orderId'),
        req.user!.id,
        req.body.reason,
        req.body.description,
      );
      res.status(201).json({ data: dispute });
    } catch (err) { next(err); }
  },
);

// Get dispute
router.get('/:disputeId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dispute = await disputesService.getDispute(param(req, 'disputeId'));
    res.json({ data: dispute });
  } catch (err) { next(err); }
});

// List disputes (admin only)
router.get('/', authenticate, authorize('admin', 'support'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await disputesService.listDisputes(queryInt(req, 'page'), queryInt(req, 'limit', 20));
    res.json({ data: result });
  } catch (err) { next(err); }
});

// Resolve dispute (support/admin only)
router.post(
  '/:disputeId/resolve',
  authenticate,
  authorize('admin', 'support'),
  validate(resolveDisputeSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dispute = await disputesService.resolveDispute(
        param(req, 'disputeId'),
        req.body.resolution,
        req.user!.id,
        req.body.notes,
      );

      if (req.body.resolution === 'REFUND_PAYER') {
        await refundPayer(dispute.orderId, req.user!.id);
      } else if (req.body.resolution === 'RELEASE_PAYEE') {
        await releasePayment(dispute.orderId, req.user!.id);
      }

      res.json({ data: dispute });
    } catch (err) { next(err); }
  },
);

export default router;