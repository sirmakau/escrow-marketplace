import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ReceiptText } from 'lucide-react';
import {
  Card,
  DataTable,
  EmptyState,
  ErrorBanner,
  PageHeader,
  Skeleton,
  StatusBadge,
} from '../components/ui';
import { displayNameFor, formatDate, money, reference } from '../format';
import { useEscrows } from '../lib/escrows';
import { stateMeta } from '../lib/status';
import { useAppState } from '../store';

type Filter = 'all' | 'incoming' | 'outgoing' | 'held';

export function Transactions() {
  const { orders, user, loading, error, refresh } = useEscrows();
  const { sessions } = useAppState();
  const [filter, setFilter] = useState<Filter>('all');

  const rows = useMemo(() => {
    const userId = user?.id;
    return orders
      .filter((order) => {
        if (filter === 'all') return true;
        const payer = order.payerId === userId;
        if (filter === 'incoming') return !payer;
        if (filter === 'outgoing') return payer;
        return stateMeta(order.state).group === 'active';
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 50);
  }, [orders, filter, user?.id]);

  return (
    <>
      <PageHeader
        title="Transactions"
        description="Escrow activity on your account. Amounts and statuses come from the order records."
      />

      {error && <ErrorBanner message={error} onRetry={() => void refresh()} />}

      <Card>
        <div className="filter-row">
          <div className="tabs" role="tablist" aria-label="Transaction filter">
            {(
              [
                ['all', 'All activity'],
                ['incoming', 'Incoming'],
                ['outgoing', 'Outgoing'],
                ['held', 'Held'],
              ] as [Filter, string][]
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={filter === id}
                className={`tab${filter === id ? ' active' : ''}`}
                onClick={() => setFilter(id)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {loading && orders.length === 0 ? (
          <Skeleton lines={6} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<ReceiptText size={22} />}
            title="No transactions match this filter"
            description="Escrow funding and releases will appear here as they happen."
          />
        ) : (
          <DataTable head={['Reference', 'Type', 'Counterparty', 'Amount', 'Status', 'Date']}>
            {rows.map((order) => {
              const isPayer = order.payerId === user?.id;
              const counterparty = isPayer ? order.payeeId : order.payerId;
              return (
                <tr key={order.id}>
                  <td>
                    <Link to={`/escrows/${order.id}`} className="row-link">
                      {reference(order.id)}
                    </Link>
                  </td>
                  <td>{isPayer ? 'Escrow payment' : 'Escrow receipt'}</td>
                  <td>{displayNameFor(counterparty, sessions)}</td>
                  <td className="num">
                    {money((order.priceCents ?? 0) + (order.calloutFeeCents ?? 0))}
                  </td>
                  <td>
                    <StatusBadge state={order.state} />
                  </td>
                  <td>{formatDate(order.createdAt)}</td>
                </tr>
              );
            })}
          </DataTable>
        )}
      </Card>

      <div className="alert alert-info">
        <ReceiptText size={18} aria-hidden="true" />
        <div>
          <strong>About this list</strong>
          <p>
            This is derived from escrow orders. The API does not expose individual M-Pesa receipts
            or wallet ledger postings to consumers, so they are not shown here.
          </p>
        </div>
      </div>

      {loading && orders.length > 0 && <p className="table-note">Refreshing…</p>}
    </>
  );
}
