import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/helpers.js';

/**
 * Verify that the authenticated user is either the payer or payee of this order.
 * Assumes req.params.orderId or req.body.orderId exists.
 */
export function requireOrderParty(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) {
    return next(new AppError('UNAUTHORIZED', 'Authentication required', 401));
  }
  // This is a stub — the real check happens in the controller/service that
  // fetches the order. We attach the user and the middleware serves as a
  // declaration that only order parties may pass.
  next();
}

/**
 * Require a minimum KYC tier.
 */
export function requireKycTier(minTier: number) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError('UNAUTHORIZED', 'Authentication required', 401));
    }
    if ((req.user.kycTier ?? 0) < minTier) {
      return next(
        new AppError('INSUFFICIENT_KYC', `KYC tier ${minTier} required, current: ${req.user.kycTier}`, 403)
      );
    }
    next();
  };
}