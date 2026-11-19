import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/helpers.js';

/** Require one of the given global roles */
export function authorize(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError('UNAUTHORIZED', 'Authentication required', 401));
    }
    if (!roles.includes(req.user.role)) {
      return next(new AppError('FORBIDDEN', `Requires role: ${roles.join(' | ')}`, 403));
    }
    next();
  };
}