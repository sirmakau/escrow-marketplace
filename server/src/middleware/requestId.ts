import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

declare global {
  namespace Express {
    interface Request {
      requestId: string;
      userId?: string;
      userRole?: string;
      /** parsed JWT payload */
      user?: { id: string; role: string; kycTier: number };
      /** Raw body kept for webhook signature verification */
      rawBody?: Buffer;
    }
  }
}

export function requestIdMiddleware(req: Request, _res: Response, next: NextFunction) {
  req.requestId = (req.headers['x-request-id'] as string) || uuidv4();
  next();
}