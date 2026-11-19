import { z } from 'zod';
import dotenv from 'dotenv';
dotenv.config();

const hexMin32 = z.string().min(32);
const e164Phone = z.string().regex(/^\+2547\d{8}$/);

const envSchema = z.object({
  DATABASE_URL: z.string().url(),

  JWT_ACCESS_SECRET: hexMin32,
  JWT_REFRESH_SECRET: hexMin32,
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  MPESA_MODE: z.enum(['mock', 'sandbox', 'production']).default('mock'),
  MPESA_CONSUMER_KEY: z.string().optional(),
  MPESA_CONSUMER_SECRET: z.string().optional(),
  MPESA_SHORTCODE: z.string().default('174379'),
  MPESA_PASSKEY: z.string().default(''),
  MPESA_CALLBACK_BASE_URL: z.string().url().optional(),
  MPESA_INITIATOR_NAME: z.string().optional(),
  MPESA_INITIATOR_PASSWORD: z.string().optional(),
  MPESA_CERT_PATH: z.string().default('./certs/safaricom.cer'),

  PLATFORM_FEE_PERCENT: z.coerce.number().min(0).max(100).default(10),
  FUNDING_WINDOW_MIN: z.coerce.number().positive().default(30),
  REVIEW_WINDOW_HOURS: z.coerce.number().positive().default(48),

  PORT: z.coerce.number().default(3000),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
  }
  process.exit(1);
}

export const config = {
  ...parsed.data,
  CORS_ORIGINS: parsed.data.CORS_ORIGINS.split(',').map(s => s.trim()),
  MPESA_CALLBACK_BASE_URL: parsed.data.MPESA_CALLBACK_BASE_URL ?? `http://localhost:${parsed.data.PORT}`,
  isMock: parsed.data.MPESA_MODE === 'mock',
  isSandbox: parsed.data.MPESA_MODE === 'sandbox',
  isProduction: parsed.data.MPESA_MODE === 'production',
} as const;

export type Config = typeof config;