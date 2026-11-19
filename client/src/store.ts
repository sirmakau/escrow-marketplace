/**
 * Small external stores for sessions and the activity log.
 *
 * Sessions live in localStorage so several accounts can be signed in at once
 * (the escrow flow needs a payer and a payee), with one marked active.
 * Components subscribe with useSyncExternalStore.
 */

import { useSyncExternalStore } from 'react';
import type { Session, User } from './types';

const SESSION_KEY = 'escrow-console-sessions-v1';
const ACTIVE_KEY = 'escrow-console-active-v1';
const MAX_LOG_ITEMS = 100;

/* ─── Sessions ──────────────────────────────────────────────────────────── */

export interface AppState {
  sessions: Session[];
  activePhone: string | null;
}

function loadSessions(): Session[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(SESSION_KEY) || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (s): s is Session => Boolean(s && s.phone && s.accessToken && s.refreshToken),
    );
  } catch {
    return [];
  }
}

const storedSessions = loadSessions();
const storedActive = localStorage.getItem(ACTIVE_KEY);

let state: AppState = {
  sessions: storedSessions,
  activePhone:
    storedActive && storedSessions.some((s) => s.phone === storedActive)
      ? storedActive
      : storedSessions[0]?.phone ?? null,
};

const listeners = new Set<() => void>();

function emit() {
  localStorage.setItem(SESSION_KEY, JSON.stringify(state.sessions));
  if (state.activePhone) localStorage.setItem(ACTIVE_KEY, state.activePhone);
  else localStorage.removeItem(ACTIVE_KEY);
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getState(): AppState {
  return state;
}

export function useAppState(): AppState {
  return useSyncExternalStore(subscribe, getState, getState);
}

export function activeSession(sessions = state.sessions, activePhone = state.activePhone) {
  return sessions.find((s) => s.phone === activePhone) ?? null;
}

export function setActivePhone(phone: string | null) {
  state = { ...state, activePhone: phone };
  emit();
}

export function upsertSession(session: Session, makeActive = true) {
  const index = state.sessions.findIndex((s) => s.phone === session.phone);
  const sessions =
    index >= 0
      ? state.sessions.map((s) => (s.phone === session.phone ? session : s))
      : [...state.sessions, session];
  state = {
    sessions,
    activePhone: makeActive ? session.phone : state.activePhone,
  };
  emit();
}

export function updateSessionUser(phone: string, user: User) {
  state = {
    ...state,
    sessions: state.sessions.map((s) => (s.phone === phone ? { ...s, user } : s)),
  };
  emit();
}

export function updateTokens(
  phone: string,
  tokens: { accessToken: string; refreshToken: string },
) {
  state = {
    ...state,
    sessions: state.sessions.map((s) =>
      s.phone === phone
        ? { ...s, accessToken: tokens.accessToken, refreshToken: tokens.refreshToken }
        : s,
    ),
  };
  emit();
}

export function removeSession(phone: string) {
  const sessions = state.sessions.filter((s) => s.phone !== phone);
  const activePhone =
    state.activePhone === phone ? sessions[0]?.phone ?? null : state.activePhone;
  state = { sessions, activePhone };
  emit();
}

/* ─── Activity log ──────────────────────────────────────────────────────── */

export type LogKind = 'ok' | 'err' | 'info';

export interface LogEntry {
  id: number;
  kind: LogKind;
  message: string;
  time: string;
}

let logEntries: LogEntry[] = [];
let nextLogId = 1;
const logListeners = new Set<() => void>();

function subscribeLogs(listener: () => void) {
  logListeners.add(listener);
  return () => {
    logListeners.delete(listener);
  };
}

export function addLog(kind: LogKind, message: string) {
  logEntries = [
    {
      id: nextLogId++,
      kind,
      message,
      time: new Date().toLocaleTimeString(),
    },
    ...logEntries,
  ].slice(0, MAX_LOG_ITEMS);
  for (const listener of logListeners) listener();
}

export function clearLogs() {
  logEntries = [];
  for (const listener of logListeners) listener();
}

export function useLogs(): LogEntry[] {
  return useSyncExternalStore(subscribeLogs, () => logEntries);
}
