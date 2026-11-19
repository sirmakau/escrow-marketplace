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

/** Resolve a user id to the display name of a session we know about. */
export function displayNameFor(userId: string, sessions: Session[]): string {
  const match = sessions.find((s) => s.user?.id === userId);
  return match?.user?.displayName ?? `${String(userId).slice(0, 8)}…`;
}

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
