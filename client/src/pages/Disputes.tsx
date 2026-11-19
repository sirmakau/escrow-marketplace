import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileWarning, ShieldAlert, TriangleAlert } from 'lucide-react';
import { api } from '../api';
import {
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorBanner,
  PageHeader,
  Skeleton,
  StatusBadge,
} from '../components/ui';
import { formatDate, reference } from '../format';
import { useEscrows } from '../lib/escrows';
import { humanise, stateMeta } from '../lib/status';
import type { Dispute, Paged } from '../types';

export function Disputes() {
  const { orders, user, loading, error, refresh } = useEscrows();
  const isStaff = user?.role === 'admin' || user?.role === 'support';

  if (isStaff) {
    return (
      <>
        <PageHeader
          title="Disputes"
          description="Review open cases, inspect escrow context and record resolutions."
        />
        <StaffDisputeQueue onChanged={() => void refresh()} />
      </>
    );
  }

  const disputed = orders.filter((order) => stateMeta(order.state).group === 'disputed');

  return (
    <>
      <PageHeader
        title="Disputes"
        description="Escrows where funds are paused while support reviews the case."
      />

      {error && <ErrorBanner message={error} onRetry={() => void refresh()} />}

      {loading && orders.length === 0 ? (
        <Card><Skeleton lines={5} /></Card>
      ) : disputed.length === 0 ? (
        <Card>
          <EmptyState
            icon={<ShieldAlert size={24} />}
            title="No disputes on your escrows"
            description="If something goes wrong, open a dispute from the escrow detail page. Funds stay held until support resolves it."
            action={
              <Link to="/escrows" className="btn btn-secondary">
                Go to my escrows
              </Link>
            }
          />
        </Card>
      ) : (
        <div className="dispute-stack">
          {disputed.map((order) => (
            <Card key={order.id} className="dispute-order-card">
              <div className="dispute-order-head">
                <div>
                  <span className="ref">{reference(order.id)}</span>
                  <StatusBadge state={order.state} />
                </div>
                <Link to={`/escrows/${order.id}`} className="btn btn-secondary btn-sm">
                  View escrow
                </Link>
              </div>
              <p className="muted">
                Support is reviewing this escrow. Keep any evidence and communication ready — the
                team may contact you through the support channel.
              </p>
            </Card>
          ))}
        </div>
      )}

      <p className="table-note">
        Evidence upload is not available in this API version, so support will request documents
        through the support channel.
      </p>
    </>
  );
}

/* ─── Staff queue ───────────────────────────────────────────────────────── */

export function StaffDisputeQueue({ onChanged }: { onChanged?: () => void }) {
  const [items, setItems] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'open' | 'resolved' | 'all'>('open');
  const [target, setTarget] = useState<Dispute | null>(null);
  const [resolutions, setResolutions] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api<Paged<Dispute>>('/api/disputes?limit=50', { quiet: true });
      setItems(Array.isArray(result?.items) ? result.items : []);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = items.filter((dispute) => {
    if (filter === 'all') return true;
    const open = dispute.status === 'OPEN' || dispute.status === 'IN_REVIEW';
    return filter === 'open' ? open : !open;
  });

  async function resolve() {
    if (!target) return;
    const resolution = resolutions[target.id] ?? 'REFUND_PAYER';
    setBusy(true);
    try {
      await api(`/api/disputes/${target.id}/resolve`, {
        method: 'POST',
        body: { resolution, notes: `Resolved from admin workspace (${resolution})` },
      });
      setTarget(null);
      setFeedback('Dispute resolved and the escrow ledger was updated.');
      await load();
      onChanged?.();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {feedback && (
        <div className="alert alert-success" role="status">
          <div><p>{feedback}</p></div>
        </div>
      )}
      {error && <ErrorBanner message={error} onRetry={() => void load()} />}

      <Card>
        <div className="filter-row">
          <div className="tabs" role="tablist" aria-label="Dispute filter">
            {(
              [
                ['open', 'Open cases'],
                ['resolved', 'Resolved'],
                ['all', 'All'],
              ] as const
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
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => void load()}>
            Refresh
          </button>
        </div>

        {loading ? (
          <Skeleton lines={6} />
        ) : visible.length === 0 ? (
          <EmptyState
            icon={<FileWarning size={22} />}
            title={filter === 'open' ? 'No open disputes' : 'No disputes in this view'}
            description="Cases appear here as soon as a buyer or seller opens one."
          />
        ) : (
          <div className="dispute-stack">
            {visible.map((dispute) => (
              <article className="dispute-card" key={dispute.id}>
                <div className="dispute-card-head">
                  <div>
                    <span className="ref">{reference(dispute.orderId)}</span>
                    <span className={`badge ${dispute.status === 'RESOLVED' ? 'tone-success' : 'tone-warning'}`}>
                      {humanise(dispute.status)}
                    </span>
                  </div>
                  <span className="muted">{formatDate(dispute.createdAt)}</span>
                </div>

                <div className="dispute-reason">
                  <TriangleAlert size={15} aria-hidden="true" />
                  {humanise(dispute.reason)}
                </div>
                <p className="dispute-description">{dispute.description}</p>

                {dispute.resolution && (
                  <p className="resolution-line">
                    Resolution: <strong>{humanise(dispute.resolution)}</strong>
                    {dispute.resolvedAt ? ` · ${formatDate(dispute.resolvedAt)}` : ''}
                  </p>
                )}

                {(dispute.status === 'OPEN' || dispute.status === 'IN_REVIEW') && (
                  <div className="dispute-actions">
                    <select
                      value={resolutions[dispute.id] ?? 'REFUND_PAYER'}
                      onChange={(e) =>
                        setResolutions((current) => ({ ...current, [dispute.id]: e.target.value }))
                      }
                      aria-label={`Resolution for ${reference(dispute.orderId)}`}
                    >
                      <option value="REFUND_PAYER">Refund buyer</option>
                      <option value="RELEASE_PAYEE">Release funds to seller</option>
                      <option value="SPLIT">Split funds</option>
                    </select>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => setTarget(dispute)}
                    >
                      Resolve dispute
                    </button>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={Boolean(target)}
        title="Resolve this dispute?"
        description={`This records a ${humanise(target ? resolutions[target.id] ?? 'REFUND_PAYER' : 'REFUND_PAYER')} resolution and moves funds through the ledger. This cannot be undone.`}
        confirmLabel="Confirm resolution"
        busy={busy}
        onConfirm={() => void resolve()}
        onClose={() => setTarget(null)}
      />
    </>
  );
}
