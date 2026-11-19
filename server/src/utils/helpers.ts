import { v4 as uuidv4 } from 'uuid';
import pino from 'pino';
import { config } from '../config/index.js';

export class AppError extends Error {
  constructor(
    public readonly code: AppErrorCode,
    message: string,
    public readonly statusCode: number = 400,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export type AppErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'INSUFFICIENT_KYC'
  | 'ORDER_STATE_INVALID'
  | 'TERMS_STALE'
  | 'DUPLICATE_REQUEST'
  | 'INSUFFICIENT_FUNDS'
  | 'PAYMENT_FAILED'
  | 'PAYMENT_NOT_CONFIGURED'
  | 'INTERNAL_ERROR';

export const logger = pino({
  level: config.LOG_LEVEL,
  ...(config.NODE_ENV === 'development' && {
    transport: {
      target: 'pino/file',
      options: { destination: 1 },
    },
  }),
});

/** Mask sensitive fields — phone numbers show last 4 digits */
export function maskPII(data: unknown): unknown {
  if (typeof data === 'string') {
    if (/^\+2547\d{8}$/.test(data)) return `+2547****${data.slice(-4)}`;
    if (data.length > 40) return data.slice(0, 8) + '****' + data.slice(-4);
    return data;
  }
  if (Array.isArray(data)) return data.map(maskPII);
  if (data && typeof data === 'object') {
    const masked: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
      if (['password', 'token', 'secret', 'authorization'].includes(k.toLowerCase())) {
        masked[k] = '****';
      } else {
        masked[k] = maskPII(v);
      }
    }
    return masked;
  }
  return data;
}

export function generateId(): string {
  return uuidv4();
}

export function now(): Date {
  return new Date();
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** Normalise a Kenyan phone number to E.164: 2547XXXXXXXX */
export function normalisePhone(raw: string): string {
  const cleaned = raw.replace(/[\s\-\(\)]/g, '');
  if (cleaned.startsWith('+254')) return cleaned;
  if (cleaned.startsWith('254')) return '+' + cleaned;
  if (cleaned.startsWith('07')) return '+2547' + cleaned.slice(2);
  if (cleaned.startsWith('7')) return '+2547' + cleaned.slice(1);
  if (cleaned.startsWith('01')) return '+2541' + cleaned.slice(2);
  if (cleaned.startsWith('1')) return '+2541' + cleaned.slice(1);
  throw new AppError('VALIDATION_ERROR', `Invalid phone number: ${raw}`);
}

/** Create a function that returns sequential integers (for mock timestamps etc) */
export function sequence(start = 0) {
  let i = start;
  return () => i++;
}

// Re-export commonly used crypto utility
import { randomBytes, createHash } from 'node:crypto';

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('hex');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}