import type { Session } from './types';

/** Format a cents amount as KES. */
export function money(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return '—';
  return (Number(cents) / 100).toLocaleString('en-KE', {
    style: 'currency',
    currency: 'KES',
    maximumFractionDigits: 2,
  });
}

/** Short escrow reference, e.g. ESC-3F9A21C4. */
export function reference(id: string): string {
  return `ESC-${id.slice(0, 8).toUpperCase()}`;
}

export function shortId(id: string | null | undefined): string {
  if (!id) return '—';
  return `${id.slice(0, 8)}…`;
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-KE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-KE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function timeAgo(value: string | Date | null | undefined): string {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  const diff = Date.now() - date.getTime();
  if (Number.isNaN(diff)) return '';
  const minutes = Math.round(diff / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(date);
}

/** Resolve a user id to the display name of a session we know about. */
export function displayNameFor(userId: string, sessions: Session[]): string {
  const match = sessions.find((s) => s.user?.id === userId);
  return match?.user?.displayName ?? shortId(userId);
}

export function isDueSoon(value: string | null | undefined, hours = 48): boolean {
  if (!value) return false;
  const diff = new Date(value).getTime() - Date.now();
  return diff > 0 && diff <= hours * 3_600_000;
}

export function isOverdue(value: string | null | undefined): boolean {
  if (!value) return false;
  return new Date(value).getTime() < Date.now();
}

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
