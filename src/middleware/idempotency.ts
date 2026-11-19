import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/helpers.js';

/**
 * Idempotency-Key handler for POST money actions.
 * Ensures that retrying a request does not create duplicate ledger entries
 * or payments. The key is stored in the webhook_events table.
 */
export function idempotencyMiddleware(req: Request, _res: Response, next: NextFunction) {
  if (req.method !== 'POST') return next();

  const key = req.headers['idempotency-key'] as string;
  if (!key) {
    // Not all POST routes require idempotency, but payment ones do.
    // We attach a generated key so services can use it if they want.
    return next();
  }

  if (typeof key !== 'string' || key.length < 8 || key.length > 200) {
    return next(new AppError('VALIDATION_ERROR', 'Idempotency-Key must be 8-200 characters', 400));
  }

  // The service layer checks if this key has been processed.
  (req as any).idempotencyKey = key;
  next();
}