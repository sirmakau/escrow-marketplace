import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Bell, CalendarClock, CheckCircle2, TriangleAlert } from 'lucide-react';
import { Card, EmptyState, ErrorBanner, PageHeader, Skeleton } from '../components/ui';
import { formatDate, isDueSoon, isOverdue, reference, timeAgo } from '../format';
import { useEscrows } from '../lib/escrows';
import { needsAction, pendingReason, stateMeta } from '../lib/status';

interface Alert {
  id: string;
  kind: 'action' | 'deadline' | 'dispute';
  title: string;
  detail: string;
  at: string;
  href: string;
  urgent?: boolean;
}

export function Notifications() {
  const { orders, user, loading, error, refresh } = useEscrows();

  const alerts = useMemo(() => {
    const list: Alert[] = [];

    for (const order of orders) {
      if (needsAction(order, user?.id)) {
        list.push({
          id: `action-${order.id}`,
          kind: 'action',
          title: pendingReason(order, user?.id) ?? 'Escrow needs your attention',
          detail: reference(order.id),
          at: order.updatedAt,
          href: `/escrows/${order.id}`,
          urgent: true,
        });
      }

      if (stateMeta(order.state).group === 'disputed') {
        list.push({
          id: `dispute-${order.id}`,
          kind: 'dispute',
          title: 'Dispute under review',
          detail: `${reference(order.id)} · support is reviewing the evidence`,
          at: order.updatedAt,
          href: `/escrows/${order.id}`,
          urgent: true,
        });
      }

      if (order.state === 'ACCEPTED' && order.fundingDeadline) {
        if (isDueSoon(order.fundingDeadline, 72) || isOverdue(order.fundingDeadline)) {
          list.push({
            id: `funding-${order.id}`,
            kind: 'deadline',
            title: isOverdue(order.fundingDeadline)
              ? 'Funding deadline passed'
              : 'Funding deadline approaching',
            detail: `${reference(order.id)} · ${formatDate(order.fundingDeadline)}`,
            at: order.fundingDeadline,
            href: `/escrows/${order.id}`,
            urgent: isOverdue(order.fundingDeadline),
          });
        }
      }

      if (
        order.reviewDeadline &&
        ['DELIVERED', 'COMPLETED'].includes(order.state) &&
        (isDueSoon(order.reviewDeadline, 72) || isOverdue(order.reviewDeadline))
      ) {
        list.push({
          id: `review-${order.id}`,
          kind: 'deadline',
          title: isOverdue(order.reviewDeadline)
            ? 'Review deadline passed'
            : 'Review deadline approaching',
          detail: `${reference(order.id)} · ${formatDate(order.reviewDeadline)}`,
          at: order.reviewDeadline,
          href: `/escrows/${order.id}`,
          urgent: isOverdue(order.reviewDeadline),
        });
      }
    }

    return list.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  }, [orders, user?.id]);

  return (
    <>
      <PageHeader
        title="Notifications"
        description="Action items and deadlines derived from your live escrow records."
      />

      {error && <ErrorBanner message={error} onRetry={() => void refresh()} />}

      <Card>
        {loading && orders.length === 0 ? (
          <Skeleton lines={6} />
        ) : alerts.length === 0 ? (
          <EmptyState
            icon={<CheckCircle2 size={24} />}
            title="You're all caught up"
            description="New action items, disputes and approaching deadlines will appear here."
          />
        ) : (
          <ul className="notification-list">
            {alerts.map((alert) => (
              <li key={alert.id} className={alert.urgent ? 'urgent' : ''}>
                <Link to={alert.href}>
                  <span className={`notification-icon kind-${alert.kind}`} aria-hidden="true">
                    {alert.kind === 'dispute' ? (
                      <TriangleAlert size={17} />
                    ) : alert.kind === 'deadline' ? (
                      <CalendarClock size={17} />
                    ) : (
                      <Bell size={17} />
                    )}
                  </span>
                  <span className="notification-body">
                    <strong>{alert.title}</strong>
                    <span>{alert.detail}</span>
                  </span>
                  <time>{timeAgo(alert.at)}</time>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <p className="table-note">
        Notifications are generated securely from your escrow data. Message delivery and read
        receipts are not part of this API version.
      </p>
    </>
  );
}
