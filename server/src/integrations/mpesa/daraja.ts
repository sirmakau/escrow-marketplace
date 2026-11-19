/**
 * M-Pesa Daraja Integration
 *
 * Supports three modes:
 *   mock   – in-memory fake that accepts STK pushes and fires callbacks after a delay
 *   sandbox – live sandbox.safaricom.co.ke
 *   production – api.safaricom.co.ke
 *
 * In mock mode everything works with zero credentials. For sandbox you need
 * real Safaricom developer credentials. For production, swap the URL and
 * use production credentials.
 */

import { config } from '../../config/index.js';
import { AppError, logger, sleep, generateId } from '../../utils/helpers.js';
import crypto from 'node:crypto';
import fs from 'node:fs';

// ─── Types ────────────────────────────────────────────────────────────────
export interface StkPushRequest {
  amount: number;       // cents
  phone: string;        // E.164
  orderId: string;
  accountReference: string;
  transactionDesc: string;
}

export interface StkPushResponse {
  CheckoutRequestID: string;
  MerchantRequestID: string;
  ResponseCode: string;
  ResponseDescription: string;
}

export interface StkCallback {
  CheckoutRequestID: string;
  MerchantRequestID: string;
  ResultCode: number;
  ResultDesc: string;
  Amount?: number;
  MpesaReceiptNumber?: string;
  TransactionDate?: string;
  PhoneNumber?: string;
}

export interface B2CRequest {
  amount: number;       // cents
  phone: string;        // E.164
  receiverName: string;
  occasion?: string;
  remarks: string;
}

export interface B2CResponse {
  ConversationID: string;
  OriginatorConversationID: string;
  ResponseCode: string;
}

// ─── Base URL ─────────────────────────────────────────────────────────────
function baseUrl(): string {
  if (config.isMock) return 'http://localhost:3000/internal/mock-mpesa';
  if (config.isSandbox) return 'https://sandbox.safaricom.co.ke';
  return 'https://api.safaricom.co.ke';
}

function requireStkConfig() {
  const { MPESA_CONSUMER_KEY, MPESA_CONSUMER_SECRET, MPESA_SHORTCODE, MPESA_PASSKEY } = config;
  if (!config.isStkPushEnabled || !MPESA_CONSUMER_KEY || !MPESA_CONSUMER_SECRET || !MPESA_SHORTCODE || !MPESA_PASSKEY) {
    throw new AppError('PAYMENT_NOT_CONFIGURED', 'M-Pesa STK Push is not configured', 503);
  }

  return { consumerKey: MPESA_CONSUMER_KEY, consumerSecret: MPESA_CONSUMER_SECRET, shortcode: MPESA_SHORTCODE, passkey: MPESA_PASSKEY };
}

export function generateB2cSecurityCredential(
  password: string,
  certificatePem?: string,
  certificatePath?: string,
): string {
  const certificate = certificatePem
    ? crypto.createPublicKey(certificatePem)
    : new crypto.X509Certificate(fs.readFileSync(certificatePath!)).publicKey;
  return crypto.publicEncrypt(
    { key: certificate, padding: crypto.constants.RSA_PKCS1_PADDING },
    Buffer.from(password, 'utf8'),
  ).toString('base64');
}

// ─── Mock Daraja ────────────────────────────────────────────────────���─────
class MockDaraja {
  private pendingStk: Map<string, { amount: number; phone: string; orderId: string }> = new Map();
  private callbackHandlers: Array<(cb: StkCallback) => void> = [];

  async getToken(): Promise<string> {
    return 'mock-access-token-' + generateId();
  }

  async stkPush(req: StkPushRequest): Promise<StkPushResponse> {
    const checkoutId = 'mock-CR-' + generateId().slice(0, 8);
    this.pendingStk.set(checkoutId, { amount: req.amount, phone: req.phone, orderId: req.orderId });

    // Simulate async callback after 2 seconds
    setTimeout(() => {
      const cb: StkCallback = {
        CheckoutRequestID: checkoutId,
        MerchantRequestID: 'mock-MR-' + generateId().slice(0, 8),
        ResultCode: 0,  // success
        ResultDesc: 'The service request is processed successfully.',
        Amount: req.amount,
        MpesaReceiptNumber: 'mock-RCPT-' + generateId().slice(0, 8).toUpperCase(),
        TransactionDate: new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14),
        PhoneNumber: req.phone,
      };
      for (const handler of this.callbackHandlers) handler(cb);
    }, 2000);

    return {
      CheckoutRequestID: checkoutId,
      MerchantRequestID: 'mock-MR-' + generateId().slice(0, 8),
      ResponseCode: '0',
      ResponseDescription: 'Success. Request accepted for processing',
    };
  }

  async stkQuery(checkoutRequestId: string): Promise<StkCallback> {
    return {
      CheckoutRequestID: checkoutRequestId,
      MerchantRequestID: 'mock-MR',
      ResultCode: 0,
      ResultDesc: 'The service request has been completed successfully.',
    };
  }

  async b2c(req: B2CRequest): Promise<B2CResponse> {
    if (!config.isB2cEnabled) {
      throw new AppError('PAYMENT_NOT_CONFIGURED', 'B2C payouts are not configured', 503);
    }
    return {
      ConversationID: 'mock-CONV-' + generateId().slice(0, 8),
      OriginatorConversationID: 'mock-ORIG-' + generateId().slice(0, 8),
      ResponseCode: '0',
    };
  }

  onStkCallback(handler: (cb: StkCallback) => void) {
    this.callbackHandlers.push(handler);
  }
}

// ─── Live Daraja (sandbox/production) ─────────────────────────────────────
class LiveDaraja {
  private accessToken: string | null = null;
  private tokenExpiresAt: number = 0;

  async getToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiresAt - 60_000) {
      return this.accessToken;
    }

    const { consumerKey, consumerSecret } = requireStkConfig();
    const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
    const res = await fetch(`${baseUrl()}/oauth/v1/generate?grant_type=client_credentials`, {
      method: 'GET',
      headers: { Authorization: `Basic ${auth}` },
    });

    if (!res.ok) {
      throw new AppError('PAYMENT_FAILED', `Failed to get M-Pesa token: ${res.status}`, 502);
    }

    const data = await res.json() as any;
    this.accessToken = data.access_token;
    this.tokenExpiresAt = Date.now() + (data.expires_in || 3599) * 1000;
    return this.accessToken!;
  }

  private generatePassword(): string {
    const { shortcode, passkey } = requireStkConfig();
    const timestamp = this.timestamp();
    const raw = shortcode + passkey + timestamp;
    return Buffer.from(raw).toString('base64');
  }

  private timestamp(): string {
    const now = new Date();
    return now.getFullYear().toString() +
      String(now.getMonth() + 1).padStart(2, '0') +
      String(now.getDate()).padStart(2, '0') +
      String(now.getHours()).padStart(2, '0') +
      String(now.getMinutes()).padStart(2, '0') +
      String(now.getSeconds()).padStart(2, '0');
  }

  private securityCredential(): string {
    if (!config.isB2cEnabled || !config.MPESA_INITIATOR_PASSWORD) {
      throw new AppError('PAYMENT_NOT_CONFIGURED', 'B2C payouts are not configured', 503);
    }

    try {
      return generateB2cSecurityCredential(
        config.MPESA_INITIATOR_PASSWORD,
        config.MPESA_CERT_PEM,
        config.MPESA_CERT_PATH,
      );
    } catch {
      throw new AppError('PAYMENT_NOT_CONFIGURED', 'B2C payouts are not configured', 503);
    }
  }

  async stkPush(req: StkPushRequest): Promise<StkPushResponse> {
    const token = await this.getToken();
    const { shortcode } = requireStkConfig();
    const callbackUrl = `${config.MPESA_CALLBACK_BASE_URL}/api/payments/mpesa/stk-callback`;

    const body = {
      BusinessShortCode: shortcode,
      Password: this.generatePassword(),
      Timestamp: this.timestamp(),
      TransactionType: 'CustomerPayBillOnline',
      Amount: (req.amount / 100).toFixed(0),  // API takes shillings as string
      PartyA: req.phone.replace('+', ''),
      PartyB: shortcode,
      PhoneNumber: req.phone.replace('+', ''),
      CallBackURL: callbackUrl,
      AccountReference: req.accountReference || req.orderId.slice(0, 12),
      TransactionDesc: req.transactionDesc || 'Escrow payment',
    };

    const res = await fetch(`${baseUrl()}/mpesa/stkpush/v1/processrequest`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      logger.error({ status: res.status, body: text }, 'STK Push failed');
      throw new AppError('PAYMENT_FAILED', `STK Push failed: ${res.status}`, 502);
    }

    return res.json() as Promise<StkPushResponse>;
  }

  async stkQuery(checkoutRequestId: string): Promise<StkCallback> {
    const token = await this.getToken();
    const { shortcode } = requireStkConfig();
    const body = {
      BusinessShortCode: shortcode,
      Password: this.generatePassword(),
      Timestamp: this.timestamp(),
      CheckoutRequestID: checkoutRequestId,
    };

    const res = await fetch(`${baseUrl()}/mpesa/stkpushquery/v1/query`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      throw new AppError('PAYMENT_FAILED', `STK Query failed: ${res.status}`, 502);
    }

    const data = await res.json() as any;
    return {
      CheckoutRequestID: data.CheckoutRequestID,
      MerchantRequestID: data.MerchantRequestID,
      ResultCode: parseInt(data.ResultCode || '1'),
      ResultDesc: data.ResultDesc || '',
    };
  }

  async b2c(req: B2CRequest): Promise<B2CResponse> {
    if (!config.isB2cEnabled) {
      throw new AppError('PAYMENT_NOT_CONFIGURED', 'B2C payouts are not configured', 503);
    }
    const { shortcode } = requireStkConfig();
    const token = await this.getToken();
    const callbackUrl = `${config.MPESA_CALLBACK_BASE_URL}/api/payments/mpesa/b2c-callback`;
    const timeoutUrl = `${config.MPESA_CALLBACK_BASE_URL}/api/payments/mpesa/b2c-timeout`;

    const body = {
      InitiatorName: config.MPESA_INITIATOR_NAME,
      SecurityCredential: this.securityCredential(),
      CommandID: 'BusinessPayment',
      Amount: (req.amount / 100).toFixed(0),
      PartyA: shortcode,
      PartyB: req.phone.replace('+', ''),
      Remarks: req.remarks || 'Escrow payout',
      QueueTimeOutURL: timeoutUrl,
      ResultURL: callbackUrl,
      Occasion: req.occasion || '',
    };

    const res = await fetch(`${baseUrl()}/mpesa/b2c/v1/paymentrequest`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      throw new AppError('PAYMENT_FAILED', `B2C failed: ${res.status}`, 502);
    }

    return res.json() as Promise<B2CResponse>;
  }

  onStkCallback(_handler: (cb: StkCallback) => void) {
    // In sandbox/production, callbacks come via webhooks so this is a no-op.
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────
let instance: MockDaraja | LiveDaraja;

export function getDaraja() {
  if (!instance) {
    instance = config.isMock ? new MockDaraja() : new LiveDaraja();
  }
  return instance;
}

export { MockDaraja, LiveDaraja };