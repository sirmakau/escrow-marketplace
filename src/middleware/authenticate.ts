import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { AppError, logger } from '../utils/helpers.js';

export interface JwtPayload {
  id: string;
  role: string;
  kycTier: number;
  iat?: number;
  exp?: number;
}

export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return next(new AppError('UNAUTHORIZED', 'Missing or invalid Authorization header', 401));
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, config.JWT_ACCESS_SECRET) as JwtPayload;
    req.user = { id: payload.id, role: payload.role, kycTier: payload.kycTier };
    req.userId = payload.id;
    req.userRole = payload.role;
    next();
  } catch (err) {
    logger.warn({ err, maskedToken: token.slice(0, 8) + '****' }, 'JWT verification failed');
    next(new AppError('UNAUTHORIZED', 'Invalid or expired token', 401));
  }
}