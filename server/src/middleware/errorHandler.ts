import { Request, Response, NextFunction } from 'express';
import { AppError, logger } from '../utils/helpers.js';

/**
 * Central error handler. Catches AppError and unexpected errors.
 * Never leaks stack traces in production.
 */
export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    logger.warn(
      { requestId: req.requestId, code: err.code, statusCode: err.statusCode },
      err.message,
    );
    return res.status(err.statusCode).json({
      error: { code: err.code, message: err.message, details: err.details },
    });
  }

  // Unexpected error
  logger.error(
    { requestId: req.requestId, err: err.message, stack: err.stack },
    'Unhandled error',
  );
  return res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: process.env.NODE_ENV === 'production'
        ? 'An unexpected error occurred'
        : err.message,
    },
  });
}