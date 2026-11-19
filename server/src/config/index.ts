import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import dotenv from 'dotenv';

// Server credentials live in server/.env, independent of client env files.
dotenv.config({
  path: path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '.env'),
});

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
  MPESA_SHORTCODE: z.string().optional(),
  MPESA_PASSKEY: z.string().default(''),
  MPESA_CALLBACK_BASE_URL: z.string().url().optional(),
  MPESA_INITIATOR_NAME: z.string().optional(),
  MPESA_INITIATOR_PASSWORD: z.string().optional(),
  MPESA_CERT_PATH: z.string().default('./certs/safaricom.cer'),
  MPESA_CERT_PEM: z.string().optional(),

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

/**
 * M-Pesa credentials can be supplied per mode, e.g.
 * MPESA_SANDBOX_CONSUMER_KEY and MPESA_PRODUCTION_CONSUMER_KEY.
 * Both sets may live in the environment at once; MPESA_MODE picks one.
 * Unscoped MPESA_* names remain supported as fallbacks.
 */
const mode = parsed.data.MPESA_MODE;
const scopedPrefix = mode === 'sandbox'
  ? 'MPESA_SANDBOX'
  : mode === 'production'
    ? 'MPESA_PRODUCTION'
    : null;

function pickMpesaValue(name: string, fallback: string | undefined): string | undefined {
  if (scopedPrefix) {
    const scoped = process.env[`${scopedPrefix}_${name}`]?.trim();
    if (scoped) return scoped;
  }
  const value = fallback?.trim();
  return value || undefined;
}

const mpesa = {
  MPESA_CONSUMER_KEY: pickMpesaValue('CONSUMER_KEY', parsed.data.MPESA_CONSUMER_KEY),
  MPESA_CONSUMER_SECRET: pickMpesaValue('CONSUMER_SECRET', parsed.data.MPESA_CONSUMER_SECRET),
  MPESA_SHORTCODE: pickMpesaValue('SHORTCODE', parsed.data.MPESA_SHORTCODE),
  MPESA_PASSKEY: pickMpesaValue('PASSKEY', parsed.data.MPESA_PASSKEY) ?? '',
  MPESA_CALLBACK_BASE_URL: pickMpesaValue('CALLBACK_BASE_URL', parsed.data.MPESA_CALLBACK_BASE_URL),
  MPESA_INITIATOR_NAME: pickMpesaValue('INITIATOR_NAME', parsed.data.MPESA_INITIATOR_NAME),
  MPESA_INITIATOR_PASSWORD: pickMpesaValue('INITIATOR_PASSWORD', parsed.data.MPESA_INITIATOR_PASSWORD),
  MPESA_CERT_PATH: pickMpesaValue('CERT_PATH', parsed.data.MPESA_CERT_PATH) ?? './certs/safaricom.cer',
  MPESA_CERT_PEM: pickMpesaValue('CERT_PEM', parsed.data.MPESA_CERT_PEM)?.replace(/\\n/g, '\n'),
};

const callbackBaseUrl = mpesa.MPESA_CALLBACK_BASE_URL ?? `http://localhost:${parsed.data.PORT}`;

// Fail fast on Render instead of discovering missing Daraja credentials at the
// first STK Push. Mock mode needs none of these.
if (mode !== 'mock') {
  const required: Array<[string, string | undefined]> = [
    [`${scopedPrefix}_CONSUMER_KEY`, mpesa.MPESA_CONSUMER_KEY],
    [`${scopedPrefix}_CONSUMER_SECRET`, mpesa.MPESA_CONSUMER_SECRET],
    [`${scopedPrefix}_SHORTCODE`, mpesa.MPESA_SHORTCODE],
    [`${scopedPrefix}_PASSKEY`, mpesa.MPESA_PASSKEY],
  ];
  const missing = required.filter(([, value]) => !value).map(([key]) => key);
  const httpsCallback = callbackBaseUrl.startsWith('https://');

  if (missing.length > 0 || !httpsCallback) {
    console.error(`❌ M-Pesa ${mode} mode is not configured:`);
    for (const key of missing) console.error(`  - ${key} is missing`);
    if (!httpsCallback) {
      console.error('  - MPESA_CALLBACK_BASE_URL must be a public HTTPS URL');
    }
    process.exit(1);
  }

  if (!mpesa.MPESA_INITIATOR_NAME || !mpesa.MPESA_INITIATOR_PASSWORD) {
    console.warn(`⚠️  M-Pesa ${mode} mode: initiator credentials are not set; B2C payouts will fail.`);
  }
}

export const config = {
  ...parsed.data,
  ...mpesa,
  CORS_ORIGINS: parsed.data.CORS_ORIGINS.split(',').map(s => s.trim()),
  MPESA_SHORTCODE: mpesa.MPESA_SHORTCODE ?? '174379',
  MPESA_CALLBACK_BASE_URL: callbackBaseUrl,
  isMock: mode === 'mock',
  isSandbox: mode === 'sandbox',
  isProduction: mode === 'production',
} as const;

export type Config = typeof config;