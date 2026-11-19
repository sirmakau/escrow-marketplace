/**
 * Test setup — loads env, inits mock DB context.
 * In a real project, use testcontainers or a test DB.
 * For now, we test pure logic and mock the DB calls.
 */

import { beforeAll, vi } from 'vitest';
import dotenv from 'dotenv';

// Load test env
dotenv.config({ path: '.env.example' });
process.env.DATABASE_URL = 'postgres://test:test@localhost:5432/escrow_test';
process.env.MPESA_MODE = 'mock';
process.env.JWT_ACCESS_SECRET = 'a'.repeat(32);
process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);

// Mock the DB client for unit tests
vi.mock('../src/db/client', () => {
  return {
    db: {
      select: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      transaction: vi.fn(),
      $count: vi.fn(),
    },
    schema: {},
    withTx: vi.fn(),
    DB: {},
  };
});