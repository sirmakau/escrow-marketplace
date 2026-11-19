import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { z } from 'zod';
import dotenv from 'dotenv';

const currentFile = fileURLToPath(import.meta.url);
const serverRoot = path.resolve(path.dirname(currentFile), '..', '..');

// dotenv does not override variables already supplied by the process.
dotenv.config({ path: path.join(serverRoot, '.env') });

const optionalTrimmed = z.preprocess(
  value => typeof value === 'string' ? value.trim() || undefined : value,
  z.string().optional(),
);

const envSchema = z.object({
  DATABASE_URL: z.string().trim().url(),
  JWT_ACCESS_SECRET: z.string().trim().min(32),
  JWT_REFRESH_SECRET: z.string().trim().min(32),
  JWT_ACCESS_EXPIRES_IN: z.string().trim().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().trim().default('7d'),

  MPESA_MODE: z.enum(['mock', 'sandbox', 'production']).default('mock'),
  MPESA_CALLBACK_BASE_URL: optionalTrimmed,
  MPESA_SANDBOX_CONSUMER_KEY: optionalTrimmed,
  MPESA_SANDBOX_CONSUMER_SECRET: optionalTrimmed,
  MPESA_SANDBOX_SHORTCODE: optionalTrimmed,
  MPESA_SANDBOX_PASSKEY: optionalTrimmed,
  MPESA_SANDBOX_INITIATOR_NAME: optionalTrimmed,
  MPESA_SANDBOX_INITIATOR_PASSWORD: optionalTrimmed,
  MPESA_SANDBOX_CERT_PATH: optionalTrimmed,
  MPESA_SANDBOX_CERT_PEM: optionalTrimmed,
  MPESA_PRODUCTION_CONSUMER_KEY: optionalTrimmed,
  MPESA_PRODUCTION_CONSUMER_SECRET: optionalTrimmed,
  MPESA_PRODUCTION_SHORTCODE: optionalTrimmed,
  MPESA_PRODUCTION_PASSKEY: optionalTrimmed,
  MPESA_PRODUCTION_INITIATOR_NAME: optionalTrimmed,
  MPESA_PRODUCTION_INITIATOR_PASSWORD: optionalTrimmed,
  MPESA_PRODUCTION_CERT_PATH: optionalTrimmed,
  MPESA_PRODUCTION_CERT_PEM: optionalTrimmed,

  PLATFORM_FEE_PERCENT: z.coerce.number().min(0).max(100).default(10),
  FUNDING_WINDOW_MIN: z.coerce.number().positive().default(30),
  REVIEW_WINDOW_HOURS: z.coerce.number().positive().default(48),
  PORT: z.coerce.number().default(3000),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

export type MpesaEnvironment = z.infer<typeof envSchema>;
type RawEnv = MpesaEnvironment;
type MpesaMode = RawEnv['MPESA_MODE'];

export interface MpesaConfig {
  mode: MpesaMode;
  consumerKey?: string;
  consumerSecret?: string;
  shortcode?: string;
  passkey?: string;
  callbackBaseUrl: string;
  initiatorName?: string;
  initiatorPassword?: string;
  certPath: string;
  certPem?: string;
  certificateReady: boolean;
  isStkPushEnabled: boolean;
  isB2cEnabled: boolean;
}

function scopedValue(raw: RawEnv, prefix: 'SANDBOX' | 'PRODUCTION', name: string): string | undefined {
  const value = raw[`MPESA_${prefix}_${name}` as keyof RawEnv] as string | undefined;
  return value?.trim() || undefined;
}

function certificatePublicKey(certPem: string | undefined, certPath: string): crypto.KeyObject {
  if (certPem) return crypto.createPublicKey(certPem);
  const certificate = fs.readFileSync(certPath);
  return new crypto.X509Certificate(certificate).publicKey;
}

function validateHttpsUrl(value: string | undefined, name: string, required: boolean): string | undefined {
  if (!value) {
    if (required) throw new Error(`M-Pesa configuration missing ${name}`);
    return undefined;
  }
  const parsed = new URL(value);
  if (required && parsed.protocol !== 'https:') {
    throw new Error(`M-Pesa configuration requires ${name} to use HTTPS`);
  }
  return value;
}

export function resolveMpesaConfig(raw: RawEnv): MpesaConfig {
  if (raw.MPESA_MODE === 'mock') {
    return {
      mode: raw.MPESA_MODE,
      callbackBaseUrl: raw.MPESA_CALLBACK_BASE_URL ?? `http://localhost:${raw.PORT}`,
      certPath: path.resolve(serverRoot, 'certs/safaricom.cer'),
      certificateReady: false,
      isStkPushEnabled: true,
      isB2cEnabled: false,
    };
  }

  const prefix = raw.MPESA_MODE === 'sandbox' ? 'SANDBOX' : 'PRODUCTION';
  const consumerKey = scopedValue(raw, prefix, 'CONSUMER_KEY');
  const consumerSecret = scopedValue(raw, prefix, 'CONSUMER_SECRET');
  const shortcode = scopedValue(raw, prefix, 'SHORTCODE');
  const passkey = scopedValue(raw, prefix, 'PASSKEY');
  const initiatorName = scopedValue(raw, prefix, 'INITIATOR_NAME');
  const initiatorPassword = scopedValue(raw, prefix, 'INITIATOR_PASSWORD');
  const configuredCertPath = scopedValue(raw, prefix, 'CERT_PATH') ?? 'certs/safaricom.cer';
  const certPem = scopedValue(raw, prefix, 'CERT_PEM')?.replace(/\\n/g, '\n');
  const certPath = path.isAbsolute(configuredCertPath)
    ? configuredCertPath
    : path.resolve(serverRoot, configuredCertPath);
  const callbackBaseUrl = validateHttpsUrl(raw.MPESA_CALLBACK_BASE_URL?.trim(), 'MPESA_CALLBACK_BASE_URL', true)!;

  const missingStk = [
    ['CONSUMER_KEY', consumerKey],
    ['CONSUMER_SECRET', consumerSecret],
    ['SHORTCODE', shortcode],
    ['PASSKEY', passkey],
  ].filter(([, value]) => !value).map(([name]) => `MPESA_${prefix}_${name}`);

  if (missingStk.length > 0) {
    throw new Error(`M-Pesa ${raw.MPESA_MODE} STK Push is not configured: missing ${missingStk.join(', ')}`);
  }

  let certificateReady = false;
  try {
    certificatePublicKey(certPem, certPath);
    certificateReady = true;
  } catch {
    certificateReady = false;
  }

  const b2cMissing = [
    ['INITIATOR_NAME', initiatorName],
    ['INITIATOR_PASSWORD', initiatorPassword],
  ].filter(([, value]) => !value).map(([name]) => `MPESA_${prefix}_${name}`);
  if (!certificateReady) {
    b2cMissing.push(`MPESA_${prefix}_CERT_PEM or MPESA_${prefix}_CERT_PATH`);
  }
  const isB2cEnabled = b2cMissing.length === 0 && certificateReady;

  return {
    mode: raw.MPESA_MODE,
    consumerKey,
    consumerSecret,
    shortcode,
    passkey,
    callbackBaseUrl,
    initiatorName,
    initiatorPassword,
    certPath,
    certPem,
    certificateReady,
    isStkPushEnabled: true,
    isB2cEnabled,
  };
}

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  const fields = parsed.error.issues.map(issue => issue.path.join('.')).join(', ');
  throw new Error(`Invalid environment configuration: ${fields}`);
}

const mpesa = resolveMpesaConfig(parsed.data);

if (parsed.data.MPESA_MODE !== 'mock' && !mpesa.isB2cEnabled) {
  const prefix = parsed.data.MPESA_MODE === 'sandbox' ? 'SANDBOX' : 'PRODUCTION';
  const missingB2c = [
    !mpesa.initiatorName && `MPESA_${prefix}_INITIATOR_NAME`,
    !mpesa.initiatorPassword && `MPESA_${prefix}_INITIATOR_PASSWORD`,
    !mpesa.certificateReady && `MPESA_${prefix}_CERT_PEM or MPESA_${prefix}_CERT_PATH`,
  ].filter(Boolean).join(', ');
  console.warn(`M-Pesa ${parsed.data.MPESA_MODE} B2C is disabled; missing or unreadable configuration: ${missingB2c}`);
}

export const config = {
  ...parsed.data,
  MPESA_CONSUMER_KEY: mpesa.consumerKey,
  MPESA_CONSUMER_SECRET: mpesa.consumerSecret,
  MPESA_SHORTCODE: mpesa.shortcode,
  MPESA_PASSKEY: mpesa.passkey,
  MPESA_CALLBACK_BASE_URL: mpesa.callbackBaseUrl,
  MPESA_INITIATOR_NAME: mpesa.initiatorName,
  MPESA_INITIATOR_PASSWORD: mpesa.initiatorPassword,
  MPESA_CERT_PATH: mpesa.certPath,
  MPESA_CERT_PEM: mpesa.certPem,
  CORS_ORIGINS: parsed.data.CORS_ORIGINS.split(',').map(value => value.trim()).filter(Boolean),
  isMock: mpesa.mode === 'mock',
  isSandbox: mpesa.mode === 'sandbox',
  isProduction: mpesa.mode === 'production',
  isStkPushEnabled: mpesa.isStkPushEnabled,
  isB2cEnabled: mpesa.isB2cEnabled,
} as const;

export type Config = typeof config;
export { serverRoot };
