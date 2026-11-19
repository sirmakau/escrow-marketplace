import { Router, Request, Response, NextFunction } from 'express';
import { validate } from '../../middleware/validate.js';
import { authenticate } from '../../middleware/authenticate.js';
import * as authService from './auth.service.js';
import { registerSchema, loginSchema, refreshSchema } from './auth.schema.js';

const router = Router();

router.post('/register', validate(registerSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tokens = await authService.register(req.body);
    res.status(201).json({ data: tokens });
  } catch (err) { next(err); }
});

router.post('/login', validate(loginSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tokens = await authService.login(req.body);
    res.json({ data: tokens });
  } catch (err) { next(err); }
});

router.post('/refresh', validate(refreshSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tokens = await authService.refreshAccessToken(req.body.refreshToken);
    res.json({ data: tokens });
  } catch (err) { next(err); }
});

router.post('/logout', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const refreshToken = req.body.refreshToken;
    await authService.logout(req.user!.id, refreshToken);
    res.json({ data: { message: 'Logged out' } });
  } catch (err) { next(err); }
});

export default router;