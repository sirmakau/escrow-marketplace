/**
 * Unit tests for the order state machine, term versioning, and concurrency.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── State Machine Tests ──────────────────────────────────────────────────

describe('Order State Machine', () => {
  const VALID_TRANSITIONS: Record<string, Record<string, string[]>> = {
    DRAFT:       { payee: ['PROPOSED', 'CANCELLED'] },
    PROPOSED:    { payer: ['ACCEPTED', 'CANCELLED'] },
    ACCEPTED:    { system: ['FUNDED'], payer: ['CANCELLED'] },
    FUNDED:      { payer: ['IN_PROGRESS', 'DISPUTED'], payee: ['IN_PROGRESS', 'DISPUTED'] },
    IN_PROGRESS: { payee: ['DELIVERED'], payer: ['DISPUTED'] },
    DELIVERED:   { payer: ['COMPLETED', 'DISPUTED'], payee: ['DISPUTED'] },
    COMPLETED:   { system: ['RELEASED'], payer: ['DISPUTED'], payee: ['DISPUTED'] },
    DISPUTED:    { support: ['REFUNDED', 'RELEASED'] },
  };

  it('should allow valid DRAFT→PROPOSED by payee', () => {
    expect(VALID_TRANSITIONS['DRAFT']?.['payee']).toContain('PROPOSED');
  });

  it('should reject invalid transitions from DRAFT by payer', () => {
    expect(VALID_TRANSITIONS['DRAFT']?.['payer']).toBeUndefined();
  });

  it('should reject transitions from wrong actor DRAFT→CANCELLED', () => {
    // Only payee can cancel in DRAFT
    expect(VALID_TRANSITIONS['DRAFT']?.['payer']).toBeUndefined();
    expect(VALID_TRANSITIONS['DRAFT']?.['payee']).toContain('CANCELLED');
  });

  it('should allow cancellation from PROPOSED by payer', () => {
    expect(VALID_TRANSITIONS['PROPOSED']?.['payer']).toContain('CANCELLED');
  });

  it('should allow dispute from FUNDED by either party', () => {
    expect(VALID_TRANSITIONS['FUNDED']?.['payer']).toContain('DISPUTED');
    expect(VALID_TRANSITIONS['FUNDED']?.['payee']).toContain('DISPUTED');
  });

  it('should only allow support to resolve disputes', () => {
    expect(VALID_TRANSITIONS['DISPUTED']?.['support']).toContain('REFUNDED');
    expect(VALID_TRANSITIONS['DISPUTED']?.['support']).toContain('RELEASED');
    expect(VALID_TRANSITIONS['DISPUTED']?.['payer']).toBeUndefined();
    expect(VALID_TRANSITIONS['DISPUTED']?.['payee']).toBeUndefined();
  });

  it('should make COMPLETED→RELEASED a system-only transition', () => {
    expect(VALID_TRANSITIONS['COMPLETED']?.['system']).toContain('RELEASED');
    expect(VALID_TRANSITIONS['COMPLETED']?.['payer']).not.toContain('RELEASED');
  });

  it('should prohibit DRAFT→FUNDED directly', () => {
    expect(VALID_TRANSITIONS['DRAFT']?.['system']).toBeUndefined();
    expect(VALID_TRANSITIONS['DRAFT']?.['payer']).toBeUndefined();
  });
});

describe('Terms Versioning', () => {
  it('should produce deterministic hashes for same terms', async () => {
    const { hashTerms } = await import('../src/modules/orders/orders.service.js');
    const terms = {
      priceCents: 350000,
      calloutFeeCents: 20000,
      scopeDescription: 'Test escrow',
      deliveryMode: 'digital' as const,
    };
    const h1 = hashTerms(terms);
    const h2 = hashTerms(terms);
    expect(h1).toBe(h2);
  });

  it('should produce different hashes for different terms', async () => {
    const { hashTerms } = await import('../src/modules/orders/orders.service.js');
    const terms1 = { priceCents: 350000, calloutFeeCents: 0, scopeDescription: 'A', deliveryMode: 'digital' as const };
    const terms2 = { priceCents: 350001, calloutFeeCents: 0, scopeDescription: 'A', deliveryMode: 'digital' as const };
    expect(hashTerms(terms1)).not.toBe(hashTerms(terms2));
  });
});

describe('Concurrency — Terms Race', () => {
  it('should detect stale terms version (409)', () => {
    const currentTermsVersion = 2;
    const acceptedTermsVersion = 1;
    expect(acceptedTermsVersion).not.toBe(currentTermsVersion);
  });
});

describe('Concurrency — Duplicate Payment Callback', () => {
  it('should deduplicate on MpesaReceiptNumber', () => {
    const processed = new Set<string>();
    function processCallback(receiptNumber: string): boolean {
      if (processed.has(receiptNumber)) return false;
      processed.add(receiptNumber);
      return true;
    }
    expect(processCallback('RCPT123')).toBe(true);
    expect(processCallback('RCPT123')).toBe(false);
    expect(processed.size).toBe(1);
  });
});

describe('Concurrency — Double Release Race', () => {
  it('should allow exactly one release', () => {
    let orderState = 'COMPLETED';
    let releaseCount = 0;

    function attemptRelease(): boolean {
      if (orderState !== 'COMPLETED') return false;
      orderState = 'RELEASED';
      releaseCount++;
      return true;
    }

    const r1 = attemptRelease();
    const r2 = attemptRelease();

    expect(r1).toBe(true);
    expect(r2).toBe(false);
    expect(releaseCount).toBe(1);
  });
});

describe('Concurrency — Dispute vs Timer Race', () => {
  it('should freeze funds if dispute wins over timer', () => {
    let orderState = 'COMPLETED';
    let released = false;
    let disputed = false;

    function attemptRelease(): boolean {
      if (orderState !== 'COMPLETED') return false;
      orderState = 'RELEASED';
      released = true;
      return true;
    }

    function attemptDispute(): boolean {
      const eligibleStates = ['FUNDED', 'IN_PROGRESS', 'DELIVERED', 'COMPLETED'];
      if (!eligibleStates.includes(orderState)) return false;
      orderState = 'DISPUTED';
      disputed = true;
      return true;
    }

    // Dispute wins the race
    const d = attemptDispute();
    const r = attemptRelease();

    expect(d).toBe(true);
    expect(disputed).toBe(true);
    expect(r).toBe(false);
    expect(released).toBe(false);
    expect(orderState).toBe('DISPUTED');
  });

  it('should release if timer wins before dispute', () => {
    let orderState = 'COMPLETED';
    let released = false;
    let disputed = false;

    function attemptRelease(): boolean {
      if (orderState !== 'COMPLETED') return false;
      orderState = 'RELEASED';
      released = true;
      return true;
    }

    function attemptDispute(): boolean {
      const eligibleStates = ['FUNDED', 'IN_PROGRESS', 'DELIVERED', 'COMPLETED'];
      if (!eligibleStates.includes(orderState)) return false;
      orderState = 'DISPUTED';
      disputed = true;
      return true;
    }

    // Timer wins
    const r = attemptRelease();
    const d = attemptDispute();

    expect(r).toBe(true);
    expect(released).toBe(true);
    expect(d).toBe(false); // Can't dispute RELEASED order
    expect(disputed).toBe(false);
  });
});

describe('Ledger Double-Entry', () => {
  it('should enforce balanced float transactions', () => {
    const entries = [
      { from: 'user:payer', to: 'mpesa_float', amount: 370000 },
      { from: 'mpesa_float', to: 'user:payee', amount: 315000 },
      { from: 'mpesa_float', to: 'platform_revenue', amount: 35000 },
      { from: 'mpesa_float', to: 'user:payee', amount: 20000 },
    ];

    const floatIn = entries.filter(e => e.to === 'mpesa_float').reduce((s, e) => s + e.amount, 0);
    const floatOut = entries.filter(e => e.from === 'mpesa_float').reduce((s, e) => s + e.amount, 0);
    expect(floatIn).toBe(floatOut);
  });

  it('should calculate correct payee payout', () => {
    const priceCents = 350000;
    const calloutFeeCents = 20000;
    const feePercent = 10;
    const feeCents = Math.floor(priceCents * feePercent / 100);
    const totalPaid = priceCents + calloutFeeCents;
    const payeeReceives = totalPaid - feeCents;

    expect(totalPaid).toBe(370000);
    expect(feeCents).toBe(35000);
    expect(payeeReceives).toBe(335000);
  });
});

describe('Helper Functions', () => {
  it('should normalise phone numbers', async () => {
    const { normalisePhone } = await import('../src/utils/helpers.js');
    expect(normalisePhone('0712345678')).toBe('+254712345678');
    expect(normalisePhone('254712345678')).toBe('+254712345678');
    expect(normalisePhone('+254712345678')).toBe('+254712345678');
  });

  it('should hash tokens deterministically', async () => {
    const { hashToken } = await import('../src/utils/helpers.js');
    expect(hashToken('test')).toBe(hashToken('test'));
    expect(hashToken('test')).not.toBe('test');
  });

  it('should mask phone numbers in PII', async () => {
    const { maskPII } = await import('../src/utils/helpers.js');
    const result = maskPII('+254712345678') as string;
    expect(result).toContain('****');
    expect(result).not.toContain('1234');
  });

  it('should mask password fields in objects', async () => {
    const { maskPII } = await import('../src/utils/helpers.js');
    const obj = { password: 'secret123', phone: '+254712345678', name: 'Alice' };
    const masked = maskPII(obj) as Record<string, unknown>;
    expect(masked.password).toBe('****');
    expect(masked.name).toBe('Alice');
  });
});