import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { requireKycTier } from '../../middleware/requireOrderParty.js';
import { validate } from '../../middleware/validate.js';
import { z } from 'zod';
import * as usersService from './users.service.js';

const router = Router();

router.get('/me', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await usersService.getUser(req.user!.id);
    const wallet = await usersService.getWallet(req.user!.id);
    res.json({ data: { ...user, wallet } });
  } catch (err) { next(err); }
});

router.get('/me/wallet', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const wallet = await usersService.getWallet(req.user!.id);
    res.json({ data: wallet });
  } catch (err) { next(err); }
});

// Admin routes
router.get('/', authenticate, authorize('admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const result = await usersService.listUsers(page, limit);
    res.json({ data: result });
  } catch (err) { next(err); }
});

const kycSchema = z.object({
  userId: z.string().uuid(),
  kycTier: z.number().int().min(1).max(2),
  kycIdNumber: z.string().min(1).max(20),
});

router.post('/kyc', authenticate, authorize('admin'), validate(kycSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await usersService.upgradeKyc(req.body.userId, req.body.kycTier, req.body.kycIdNumber, req.user!.id);
    res.json({ data: user });
  } catch (err) { next(err); }
});

export default router;