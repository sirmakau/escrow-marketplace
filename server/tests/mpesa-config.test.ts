import crypto from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { normalizeCallbackBaseUrl, resolveMpesaConfig, serverRoot, type MpesaEnvironment } from '../src/config/env.js';
import { generateB2cSecurityCredential, MockDaraja } from '../src/integrations/mpesa/daraja.js';

function environment(overrides: Partial<MpesaEnvironment> = {}): MpesaEnvironment {
  return {
    DATABASE_URL: 'postgresql://localhost:5432/escrow_test',
    JWT_ACCESS_SECRET: 'a'.repeat(32),
    JWT_REFRESH_SECRET: 'b'.repeat(32),
    JWT_ACCESS_EXPIRES_IN: '15m',
    JWT_REFRESH_EXPIRES_IN: '7d',
    MPESA_MODE: 'mock',
    MPESA_CALLBACK_BASE_URL: undefined,
    MPESA_SANDBOX_CONSUMER_KEY: undefined,
    MPESA_SANDBOX_CONSUMER_SECRET: undefined,
    MPESA_SANDBOX_SHORTCODE: undefined,
    MPESA_SANDBOX_PASSKEY: undefined,
    MPESA_SANDBOX_INITIATOR_NAME: undefined,
    MPESA_SANDBOX_INITIATOR_PASSWORD: undefined,
    MPESA_SANDBOX_CERT_PATH: undefined,
    MPESA_SANDBOX_CERT_PEM: undefined,
    MPESA_PRODUCTION_CONSUMER_KEY: undefined,
    MPESA_PRODUCTION_CONSUMER_SECRET: undefined,
    MPESA_PRODUCTION_SHORTCODE: undefined,
    MPESA_PRODUCTION_PASSKEY: undefined,
    MPESA_PRODUCTION_INITIATOR_NAME: undefined,
    MPESA_PRODUCTION_INITIATOR_PASSWORD: undefined,
    MPESA_PRODUCTION_CERT_PATH: undefined,
    MPESA_PRODUCTION_CERT_PEM: undefined,
    PLATFORM_FEE_PERCENT: 10,
    FUNDING_WINDOW_MIN: 30,
    REVIEW_WINDOW_HOURS: 48,
    PORT: 3000,
    CORS_ORIGINS: 'http://localhost:5173',
    LOG_LEVEL: 'info',
    NODE_ENV: 'test',
    ...overrides,
  };
}

function publicKeyPem() {
  return crypto.generateKeyPairSync('rsa', { modulusLength: 2048 }).publicKey
    .export({ type: 'spki', format: 'pem' }).toString();
}

function configuredProduction(overrides: Partial<MpesaEnvironment> = {}) {
  return environment({
    MPESA_MODE: 'production',
    MPESA_CALLBACK_BASE_URL: 'https://api.example.test',
    MPESA_PRODUCTION_CONSUMER_KEY: ' production-key ',
    MPESA_PRODUCTION_CONSUMER_SECRET: ' production-secret ',
    MPESA_PRODUCTION_SHORTCODE: ' 600000 ',
    MPESA_PRODUCTION_PASSKEY: ' production-passkey ',
    MPESA_PRODUCTION_CERT_PEM: publicKeyPem(),
    ...overrides,
  });
}

describe('M-Pesa environment readiness', () => {
  it('normalizes full callback URLs to a callback base origin', () => {
    expect(normalizeCallbackBaseUrl(
      'https://escrow-marketplace-8ndh.onrender.com/api/payments/mpesa/stk-callback',
    )).toBe('https://escrow-marketplace-8ndh.onrender.com');
  });

  it('allows mock mode without M-Pesa credentials', () => {
    const config = resolveMpesaConfig(environment());
    expect(config.isStkPushEnabled).toBe(true);
    expect(config.isB2cEnabled).toBe(false);
  });

  it('enables sandbox STK Push with valid sandbox credentials', () => {
    const config = resolveMpesaConfig(environment({
      MPESA_MODE: 'sandbox',
      MPESA_CALLBACK_BASE_URL: 'https://api.example.test',
      MPESA_SANDBOX_CONSUMER_KEY: 'sandbox-key',
      MPESA_SANDBOX_CONSUMER_SECRET: 'sandbox-secret',
      MPESA_SANDBOX_SHORTCODE: '123456',
      MPESA_SANDBOX_PASSKEY: 'sandbox-passkey',
    }));
    expect(config.isStkPushEnabled).toBe(true);
    expect(config.shortcode).toBe('123456');
  });

  it('requires production STK credentials and does not use sandbox values', () => {
    expect(() => resolveMpesaConfig(environment({
      MPESA_MODE: 'production',
      MPESA_CALLBACK_BASE_URL: 'https://api.example.test',
      MPESA_SANDBOX_SHORTCODE: '174379',
    }))).toThrow(/MPESA_PRODUCTION_CONSUMER_KEY/);
  });

  it('uses the explicit production shortcode, never a sandbox fallback', () => {
    const config = resolveMpesaConfig(configuredProduction({ MPESA_SANDBOX_SHORTCODE: '174379' }));
    expect(config.shortcode).toBe('600000');
    expect(config.shortcode).not.toBe('174379');
  });

  it('requires the STK passkey', () => {
    expect(() => resolveMpesaConfig(configuredProduction({ MPESA_PRODUCTION_PASSKEY: undefined })))
      .toThrow(/MPESA_PRODUCTION_PASSKEY/);
  });

  it('keeps STK enabled while disabling incomplete B2C', () => {
    const config = resolveMpesaConfig(configuredProduction());
    expect(config.isStkPushEnabled).toBe(true);
    expect(config.isB2cEnabled).toBe(false);
  });

  it('requires a readable certificate for B2C readiness', () => {
    const config = resolveMpesaConfig(configuredProduction({
      MPESA_PRODUCTION_CERT_PEM: undefined,
      MPESA_PRODUCTION_CERT_PATH: 'missing.cer',
      MPESA_PRODUCTION_INITIATOR_NAME: 'initiator',
      MPESA_PRODUCTION_INITIATOR_PASSWORD: 'password',
    }));
    expect(config.isB2cEnabled).toBe(false);
  });

  it('resolves relative certificates from server root and preserves absolute paths', () => {
    const relative = resolveMpesaConfig(configuredProduction({ MPESA_PRODUCTION_CERT_PATH: 'certs/live.cer' }));
    expect(relative.certPath).toBe(`${serverRoot}/certs/live.cer`);

    const absolutePath = '/var/secrets/safaricom.cer';
    const absolute = resolveMpesaConfig(configuredProduction({ MPESA_PRODUCTION_CERT_PATH: absolutePath }));
    expect(absolute.certPath).toBe(absolutePath);
  });

  it('trims credentials and treats whitespace-only values as missing', () => {
    const config = resolveMpesaConfig(configuredProduction());
    expect(config.consumerKey).toBe('production-key');
    expect(() => resolveMpesaConfig(configuredProduction({ MPESA_PRODUCTION_PASSKEY: '   ' })))
      .toThrow(/MPESA_PRODUCTION_PASSKEY/);
  });

  it('does not include secret values in validation errors', () => {
    try {
      resolveMpesaConfig(configuredProduction({ MPESA_PRODUCTION_PASSKEY: undefined }));
      throw new Error('expected configuration validation to fail');
    } catch (error) {
      const message = (error as Error).message;
      expect(message).toContain('MPESA_PRODUCTION_PASSKEY');
      expect(message).not.toContain('production-key');
      expect(message).not.toContain('production-secret');
      expect(message).not.toContain('production-passkey');
    }
  });
});

describe('B2C SecurityCredential', () => {
  it('refuses mock B2C payouts when B2C is disabled', async () => {
    await expect(new MockDaraja().b2c({
      amount: 100,
      phone: '+254712345678',
      receiverName: 'Test',
      remarks: 'Test',
    })).rejects.toMatchObject({ code: 'PAYMENT_NOT_CONFIGURED' });
  });

  it('encrypts the initiator password instead of returning plaintext', () => {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    const publicPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
    const credential = generateB2cSecurityCredential('initiator-password', publicPem);
    const decrypted = crypto.privateDecrypt(
      { key: privateKey, padding: crypto.constants.RSA_PKCS1_PADDING },
      Buffer.from(credential, 'base64'),
    ).toString();

    expect(credential).not.toBe('initiator-password');
    expect(decrypted).toBe('initiator-password');
  });
});
