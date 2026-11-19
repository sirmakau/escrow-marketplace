/**
 * Central API service layer.
 *
 * - One configurable base URL (`client/.env` -> VITE_API_BASE_URL).
 * - Unwraps the `{ data }` envelope and throws typed ApiErrors.
 * - Refreshes an expired access token once, then clears the session.
 * - Financial POSTs can carry an Idempotency-Key.
 */

import type { Session, Tokens, User } from './types';
import {
  activeSession,
  addLog,
  getState,
  removeSession,
  updateTokens,
  updateSessionUser,
  upsertSession,
} from './store';

/** Optional API origin; empty means same origin / Vite proxy. */
export const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/+$/, '');

export function apiUrl(path: string): string {
  return `${API_BASE}${path}`;
}

export class ApiError extends Error {
  status: number;
  code?: string;
  details?: unknown;

  constructor(message: string, status: number, code?: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  auth?: boolean;
  quiet?: boolean;
  retry?: boolean;
  session?: Session | null;
  idempotencyKey?: string;
}

async function refreshSession(session: Session): Promise<boolean> {
  try {
    const res = await fetch(apiUrl('/api/auth/refresh'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: session.refreshToken }),
    });
    if (!res.ok) return false;
    const payload = await res.json();
    const tokens = payload.data as Tokens;
    updateTokens(session.phone, tokens);
    addLog('info', 'Access token refreshed');
    return true;
  } catch {
    return false;
  }
}

export async function api<T = unknown>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, auth = true, quiet = false, retry = true, idempotencyKey } = opts;
  const session = opts.session !== undefined ? opts.session : activeSession();

  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth && session?.accessToken) headers.Authorization = `Bearer ${session.accessToken}`;
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;

  let res: Response;
  try {
    res = await fetch(apiUrl(path), {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError('Network error. Check your connection and try again.', 0, 'NETWORK_ERROR');
  }

  let payload: any = null;
  const text = await res.text();
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }
  const data =
    payload && typeof payload === 'object' && !Array.isArray(payload) && 'data' in payload
      ? payload.data
      : payload;

  if (!res.ok) {
    if (res.status === 401 && auth && retry && session?.refreshToken) {
      if (await refreshSession(session)) {
        return api<T>(path, { ...opts, retry: false, quiet });
      }
      removeSession(session.phone);
      if (!window.location.pathname.startsWith('/login')) {
        window.location.assign('/login?expired=1');
      }
    }
    const error = payload?.error;
    const message = error?.message || res.statusText || 'Request failed';
    if (!quiet) addLog('err', `${res.status} ${method} ${path} — ${message}`);
    throw new ApiError(message, res.status, error?.code, error?.details);
  }

  if (!quiet) addLog('ok', `${res.status} ${method} ${path}`);
  return data as T;
}

/* ─── Auth / sessions ───────────────────────────────────────────────────── */

export function normalisePhone(input: string): string {
  const raw = input.trim().replace(/[\s()-]/g, '');
  if (raw.startsWith('+')) return raw;
  if (raw.startsWith('254')) return `+${raw}`;
  if (raw.startsWith('0')) return `+254${raw.slice(1)}`;
  return raw;
}

async function establishSession(phone: string, tokens: Tokens): Promise<User> {
  const session: Session = {
    phone,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    user: null,
  };
  const user = await api<User>('/api/users/me', { session, quiet: true });
  session.user = user;
  upsertSession(session);
  return user;
}

export async function signIn(phone: string, password: string): Promise<User> {
  const normalised = normalisePhone(phone);
  const tokens = await api<Tokens>('/api/auth/login', {
    method: 'POST',
    body: { phone: normalised, password },
    auth: false,
    quiet: true,
  });
  const user = await establishSession(normalised, tokens);
  addLog('ok', `Signed in as ${user.displayName}`);
  return user;
}

export async function register(input: {
  phone: string;
  password: string;
  displayName: string;
}): Promise<User> {
  const normalised = normalisePhone(input.phone);
  const tokens = await api<Tokens>('/api/auth/register', {
    method: 'POST',
    body: { phone: normalised, password: input.password, displayName: input.displayName },
    auth: false,
    quiet: true,
  });
  const user = await establishSession(normalised, tokens);
  addLog('ok', `Account created for ${user.displayName}`);
  return user;
}

export async function signOut(session: Session): Promise<void> {
  try {
    await api('/api/auth/logout', {
      method: 'POST',
      body: { refreshToken: session.refreshToken },
      session,
      quiet: true,
    });
  } catch {
    /* local sign-out is enough */
  }
  removeSession(session.phone);
  addLog('info', `Signed out ${session.user?.displayName || session.phone}`);
}

export async function refreshProfile(): Promise<User | null> {
  const session = activeSession();
  if (!session) return null;
  try {
    const user = await api<User>('/api/users/me', { session, quiet: true });
    updateSessionUser(session.phone, user);
    return user;
  } catch {
    return null;
  }
}

export function sessionFor(phone: string | null): Session | null {
  return getState().sessions.find((s) => s.phone === phone) ?? null;
}

export function newIdempotencyKey(): string {
  return crypto.randomUUID();
}
