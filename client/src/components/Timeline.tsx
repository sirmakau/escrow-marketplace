import { formatDateTime } from '../format';
import type { OrderDetail } from '../types';

interface Step {
  label: string;
  detail: string;
  at?: string | null;
}

const ORDER: Record<string, number> = {
  DRAFT: 0,
  PROPOSED: 1,
  ACCEPTED: 2,
  FUNDED: 3,
  IN_PROGRESS: 4,
  DELIVERED: 5,
  COMPLETED: 6,
  RELEASED: 7,
  DISPUTED: 7,
  REFUNDED: 7,
  CANCELLED: 7,
};

/**
 * Timeline derived only from persisted order fields. The backend does not
 * store separate timestamps for work-start/delivery, so those steps show no
 * timestamp rather than a fabricated one.
 */
export function TransactionTimeline({ order }: { order: OrderDetail }) {
  const acceptance = (order.acceptances ?? []).find(
    (a) => a.termsVersion === order.termsVersion,
  );
  const reached = ORDER[order.state] ?? 0;

  const steps: Step[] = [
    { label: 'Escrow created', detail: 'Agreement opened by the seller', at: order.createdAt },
    {
      label: 'Terms accepted',
      detail: acceptance ? 'Buyer accepted the agreement' : 'Awaiting buyer acceptance',
      at: acceptance?.acceptedAt,
    },
    { label: 'Escrow funded', detail: 'Payment held by the platform', at: order.paidAt },
    { label: 'Work started', detail: 'Seller began the engagement' },
    { label: 'Delivered', detail: 'Seller marked the work delivered' },
    { label: 'Delivery confirmed', detail: 'Buyer confirmed the work', at: null },
    {
      label: order.state === 'REFUNDED' ? 'Refunded to buyer' : 'Funds released',
      detail:
        order.state === 'REFUNDED'
          ? 'Escrow was refunded'
          : 'Seller receives the escrow balance',
      at: order.releasedAt,
    },
  ];

  const terminalNote =
    order.state === 'DISPUTED'
      ? 'This escrow is under dispute. Funds remain held until support resolves it.'
      : order.state === 'CANCELLED'
        ? 'This escrow was cancelled before funds were released.'
        : null;

  return (
    <div className="timeline">
      <ol>
        {steps.map((step, index) => {
          const state = index < reached ? 'done' : index === reached ? 'current' : 'upcoming';
          return (
            <li key={step.label} className={`timeline-step ${state}`}>
              <span className="timeline-marker" aria-hidden="true">
                {state === 'done' ? '✓' : index + 1}
              </span>
              <div className="timeline-content">
                <div className="timeline-title">
                  {step.label}
                  {step.at && <time>{formatDateTime(step.at)}</time>}
                </div>
                <p>{step.detail}</p>
              </div>
            </li>
          );
        })}
      </ol>
      {terminalNote && <p className="timeline-note">{terminalNote}</p>}
    </div>
  );
}
