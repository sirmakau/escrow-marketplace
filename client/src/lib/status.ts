import type { Order } from '../types';

export type Tone = 'neutral' | 'info' | 'warning' | 'progress' | 'success' | 'danger' | 'muted';

export interface StateMeta {
  label: string;
  tone: Tone;
  group: 'active' | 'disputed' | 'closed';
}

/**
 * Presentation labels mapped to the actual order states returned by the API.
 * No state exists in the database that is not listed here.
 */
export const STATE_META: Record<string, StateMeta> = {
  DRAFT: { label: 'Draft', tone: 'neutral', group: 'active' },
  PROPOSED: { label: 'Awaiting acceptance', tone: 'info', group: 'active' },
  ACCEPTED: { label: 'Awaiting funding', tone: 'warning', group: 'active' },
  FUNDED: { label: 'Funded', tone: 'progress', group: 'active' },
  IN_PROGRESS: { label: 'In progress', tone: 'progress', group: 'active' },
  DELIVERED: { label: 'Awaiting review', tone: 'info', group: 'active' },
  COMPLETED: { label: 'Awaiting release', tone: 'warning', group: 'active' },
  DISPUTED: { label: 'Disputed', tone: 'danger', group: 'disputed' },
  RELEASED: { label: 'Released', tone: 'success', group: 'closed' },
  REFUNDED: { label: 'Refunded', tone: 'neutral', group: 'closed' },
  CANCELLED: { label: 'Cancelled', tone: 'muted', group: 'closed' },
};

export function stateMeta(state: string): StateMeta {
  return STATE_META[state] ?? { label: state, tone: 'neutral', group: 'closed' };
}

export type ActionId =
  | 'accept'
  | 'fund'
  | 'start'
  | 'deliver'
  | 'complete'
  | 'release'
  | 'cancel'
  | 'dispute';

export interface UiAction {
  id: ActionId;
  label: string;
  kind: 'primary' | 'secondary' | 'danger';
  /** Irreversible actions require an explicit confirmation. */
  confirm?: boolean;
}

export function isParty(order: Order, userId: string | undefined): boolean {
  return Boolean(userId) && (order.payerId === userId || order.payeeId === userId);
}

/** Actions the signed-in party may take, mirroring backend guards. */
export function availableActions(order: Order, userId: string | undefined): UiAction[] {
  if (!isParty(order, userId)) return [];
  const isPayer = order.payerId === userId;
  const isPayee = order.payeeId === userId;
  const actions: UiAction[] = [];

  switch (order.state) {
    case 'DRAFT':
      if (isPayee) actions.push({ id: 'cancel', label: 'Cancel escrow', kind: 'danger', confirm: true });
      break;
    case 'PROPOSED':
      if (isPayer) {
        actions.push({ id: 'accept', label: `Accept v${order.termsVersion}`, kind: 'primary' });
        actions.push({ id: 'cancel', label: 'Cancel escrow', kind: 'danger', confirm: true });
      }
      break;
    case 'ACCEPTED':
      if (isPayer) {
        actions.push({ id: 'fund', label: 'Fund escrow', kind: 'primary' });
        actions.push({ id: 'cancel', label: 'Cancel escrow', kind: 'danger', confirm: true });
      }
      break;
    case 'FUNDED':
      actions.push({ id: 'start', label: 'Start work', kind: 'primary' });
      actions.push({ id: 'dispute', label: 'Open dispute', kind: 'secondary' });
      break;
    case 'IN_PROGRESS':
      if (isPayee) actions.push({ id: 'deliver', label: 'Mark delivered', kind: 'primary' });
      actions.push({ id: 'dispute', label: 'Open dispute', kind: 'secondary' });
      break;
    case 'DELIVERED':
      if (isPayer) actions.push({ id: 'complete', label: 'Confirm delivery', kind: 'primary' });
      actions.push({ id: 'dispute', label: 'Open dispute', kind: 'secondary' });
      break;
    case 'COMPLETED':
      if (isPayer) actions.push({ id: 'release', label: 'Release funds', kind: 'primary', confirm: true });
      actions.push({ id: 'dispute', label: 'Open dispute', kind: 'secondary' });
      break;
    default:
      break;
  }

  return actions;
}

/** Human sentence describing why an escrow is waiting on the signed-in user. */
export function pendingReason(order: Order, userId: string | undefined): string | null {
  if (!isParty(order, userId)) return null;
  const isPayer = order.payerId === userId;
  const isPayee = order.payeeId === userId;

  switch (order.state) {
    case 'DRAFT':
      return isPayee ? 'Add the agreement terms and propose to the payer.' : null;
    case 'PROPOSED':
      return isPayer
        ? 'Review and accept the agreement terms.'
        : 'Waiting for the payer to accept the terms.';
    case 'ACCEPTED':
      return isPayer ? 'Fund the escrow to start the agreement.' : 'Waiting for the payer to fund the escrow.';
    case 'FUNDED':
      return 'Confirm you have started work.';
    case 'IN_PROGRESS':
      return isPayee ? 'Deliver the work and mark it delivered.' : 'Waiting for the seller to deliver.';
    case 'DELIVERED':
      return isPayer ? 'Review the delivery and confirm completion.' : 'Waiting for the buyer to confirm delivery.';
    case 'COMPLETED':
      return isPayer ? 'Release the funds to the seller.' : 'Waiting for the buyer to release funds.';
    case 'DISPUTED':
      return 'A dispute is under review by support.';
    default:
      return null;
  }
}

/** Actions that require the signed-in user's attention. */
export function needsAction(order: Order, userId: string | undefined): boolean {
  if (!isParty(order, userId)) return false;
  const isPayer = order.payerId === userId;
  const isPayee = order.payeeId === userId;
  switch (order.state) {
    case 'DRAFT':
      return isPayee;
    case 'PROPOSED':
    case 'ACCEPTED':
    case 'DELIVERED':
    case 'COMPLETED':
      return isPayer;
    case 'FUNDED':
      return true;
    case 'IN_PROGRESS':
      return isPayee;
    default:
      return false;
  }
}

export const DELIVERY_LABELS: Record<string, string> = {
  digital: 'Digital delivery',
  in_person: 'In person',
};

export const DISPUTE_REASONS = [
  'NOT_DELIVERED',
  'QUALITY',
  'NO_RESPONSE',
  'OTHER',
] as const;

export function humanise(value: string): string {
  return value
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
