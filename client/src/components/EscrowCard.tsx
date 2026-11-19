import { Link } from 'react-router-dom';
import { ArrowUpRight, CalendarClock, UserRound } from 'lucide-react';
import { displayNameFor, formatDate, money, reference, shortId } from '../format';
import { needsAction, pendingReason, stateMeta } from '../lib/status';
import { activeSession, useAppState } from '../store';
import type { Order } from '../types';
import { StatusBadge } from './ui';

export function EscrowCard({ order }: { order: Order }) {
  const { sessions, activePhone } = useAppState();
  const userId = activeSession(sessions, activePhone)?.user?.id;
  const isParty = order.payerId === userId || order.payeeId === userId;

  const isPayer = order.payerId === userId;
  const counterpartyId = isPayer ? order.payeeId : order.payerId;
  const amount = (order.priceCents ?? 0) + (order.calloutFeeCents ?? 0);
  const urgent = needsAction(order, userId);
  const reason = pendingReason(order, userId);
  const meta = stateMeta(order.state);

  const content = (
    <>
      <div className="escrow-card-top">
        <span className="ref">{reference(order.id)}</span>
        <StatusBadge state={order.state} />
      </div>

      <div className="escrow-amount">{money(amount)}</div>

      <div className="escrow-parties">
        {isParty ? (
          <>
            <span>
              <UserRound size={14} aria-hidden="true" /> You · {isPayer ? 'Buyer' : 'Seller'}
            </span>
            <span className="muted-sep">→</span>
            <span title={counterpartyId}>
              <UserRound size={14} aria-hidden="true" /> {displayNameFor(counterpartyId, sessions)}
            </span>
          </>
        ) : (
          <>
            <span title={order.payerId}>
              <UserRound size={14} aria-hidden="true" /> {displayNameFor(order.payerId, sessions)}
            </span>
            <span className="muted-sep">→</span>
            <span title={order.payeeId}>
              <UserRound size={14} aria-hidden="true" /> {displayNameFor(order.payeeId, sessions)}
            </span>
          </>
        )}
      </div>

      <div className="escrow-meta">
        <span>
          <CalendarClock size={14} aria-hidden="true" /> Created {formatDate(order.createdAt)}
        </span>
        {order.state === 'ACCEPTED' && order.fundingDeadline && (
          <span>Fund by {formatDate(order.fundingDeadline)}</span>
        )}
        {order.reviewDeadline && ['DELIVERED', 'COMPLETED'].includes(order.state) && (
          <span>Review by {formatDate(order.reviewDeadline)}</span>
        )}
      </div>

      {urgent && reason && (
        <div className="escrow-urgent">
          <span className="dot-pulse" aria-hidden="true" />
          {reason}
        </div>
      )}

      {isParty && (
        <span className="escrow-open" aria-hidden="true">
          View escrow <ArrowUpRight size={14} />
        </span>
      )}
    </>
  );

  if (!isParty) {
    return (
      <div className="escrow-card" title="Staff view. Order details are private to the parties.">
        {content}
        <span className="ref" style={{ display: 'block', marginTop: 10 }}>
          Staff visibility · party-only detail
        </span>
      </div>
    );
  }

  return (
    <Link
      to={`/escrows/${order.id}`}
      className={`escrow-card${urgent ? ' escrow-card-urgent' : ''}`}
      aria-label={`${reference(order.id)} — ${meta.label}`}
    >
      {content}
    </Link>
  );
}

export function EscrowRowLink({ order }: { order: Order }) {
  return (
    <Link to={`/escrows/${order.id}`} className="row-link">
      {reference(order.id)}
      <span className="cell-sub">{shortId(order.id)}</span>
    </Link>
  );
}
