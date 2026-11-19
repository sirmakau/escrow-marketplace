import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Info,
  PencilLine,
  ShieldCheck,
  Smartphone,
  TriangleAlert,
} from 'lucide-react';
import { api, newIdempotencyKey } from '../api';
import { TransactionTimeline } from '../components/Timeline';
import {
  Card,
  ConfirmDialog,
  ErrorBanner,
  Field,
  Modal,
  PageHeader,
  Skeleton,
  Spinner,
  StatusBadge,
} from '../components/ui';
import {
  displayNameFor,
  formatDate,
  formatDateTime,
  isOverdue,
  money,
  reference,
  sleep,
} from '../format';
import { useEscrows } from '../lib/escrows';
import {
  availableActions,
  DELIVERY_LABELS,
  DISPUTE_REASONS,
  humanise,
  stateMeta,
} from '../lib/status';
import { useAppState } from '../store';
import type { ActionId } from '../lib/status';
import type { OrderDetail } from '../types';

type DialogKind = 'cancel' | 'release' | null;
type FundStage = 'idle' | 'starting' | 'waiting' | 'confirmed' | 'timeout' | 'error';
const STK_PROMPT_TIMEOUT_SECONDS = 90;
const STK_POLL_INTERVAL_MS = 3000;

export function EscrowDetail() {
  const { id } = useParams<{ id: string }>();
  const { refresh } = useEscrows();
  const { sessions, activePhone } = useAppState();
  const session = sessions.find((s) => s.phone === activePhone) ?? null;
  const userId = session?.user?.id;

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [dialog, setDialog] = useState<DialogKind>(null);
  const [fundOpen, setFundOpen] = useState(false);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);

  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const result = await api<OrderDetail>(`/api/orders/${id}`, { quiet: true });
      if (mounted.current) setOrder(result);
    } catch (err) {
      if (mounted.current) setError((err as Error).message);
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function execute(action: ActionId) {
    if (!order) return;
    setBusy(true);
    setActionError(null);
    try {
      switch (action) {
        case 'accept':
          await api(`/api/orders/${order.id}/accept`, {
            method: 'POST',
            body: { termsVersion: order.termsVersion },
          });
          setFeedback('You accepted the agreement. The buyer can now fund the escrow.');
          break;
        case 'start':
          await api(`/api/orders/${order.id}/start`, { method: 'POST' });
          setFeedback('Work marked as started.');
          break;
        case 'deliver':
          await api(`/api/orders/${order.id}/deliver`, { method: 'POST' });
          setFeedback('Delivery recorded. The buyer can now confirm.');
          break;
        case 'complete':
          await api(`/api/orders/${order.id}/complete`, { method: 'POST' });
          setFeedback('Delivery confirmed. Funds can now be released.');
          break;
        case 'cancel':
          await api(`/api/orders/${order.id}/cancel`, { method: 'POST' });
          setFeedback('Escrow cancelled.');
          break;
        case 'release':
          await api(`/api/payments/release/${order.id}`, {
            method: 'POST',
            idempotencyKey: newIdempotencyKey(),
          });
          setFeedback('Funds released to the seller.');
          break;
        default:
          break;
      }
      setDialog(null);
      await load();
      await refresh();
    } catch (err) {
      setActionError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (loading && !order) {
    return (
      <>
        <PageHeader title="Loading escrow…" />
        <Card><Skeleton lines={7} /></Card>
      </>
    );
  }

  if (error || !order) {
    return (
      <>
        <Link to="/escrows" className="back-link"><ArrowLeft size={15} /> Back to escrows</Link>
        <ErrorBanner message={error ?? 'Escrow not found.'} onRetry={() => void load()} />
      </>
    );
  }

  const isPayer = order.payerId === userId;
  const isPayee = order.payeeId === userId;
  const actions = availableActions(order, userId);
  const meta = stateMeta(order.state);
  const latestTerms = order.terms && order.terms.length > 0 ? order.terms[order.terms.length - 1] : null;
  const buyerAccepted = (order.acceptances ?? []).find(
    (a) => a.termsVersion === order.termsVersion && a.userId === order.payerId,
  );
  const sellerAccepted = (order.acceptances ?? []).find(
    (a) => a.termsVersion === order.termsVersion && a.userId === order.payeeId,
  );
  const total = (order.priceCents ?? 0) + (order.calloutFeeCents ?? 0);

  return (
    <>
      <Link to="/escrows" className="back-link"><ArrowLeft size={15} /> Back to escrows</Link>

      <PageHeader
        eyebrow={`Escrow · ${reference(order.id)}`}
        title={money(total)}
        description={`${stateMeta(order.state).label} · created ${formatDate(order.createdAt)}`}
        actions={
          <>
            {isPayee && ['DRAFT', 'PROPOSED'].includes(order.state) && (
              <button type="button" className="btn btn-secondary" onClick={() => setTermsOpen(true)}>
                <PencilLine size={16} /> Edit terms
              </button>
            )}
            {actions.map((action) => (
              <button
                key={action.id}
                type="button"
                className={`btn ${action.kind === 'primary' ? 'btn-primary' : action.kind === 'danger' ? 'btn-danger' : 'btn-secondary'}`}
                onClick={() => {
                  setActionError(null);
                  if (action.id === 'fund') setFundOpen(true);
                  else if (action.id === 'dispute') setDisputeOpen(true);
                  else if (action.id === 'cancel') setDialog('cancel');
                  else if (action.id === 'release') setDialog('release');
                  else void execute(action.id);
                }}
                disabled={busy}
              >
                {action.label}
              </button>
            ))}
          </>
        }
      />

      <div className="detail-status-bar">
        <StatusBadge state={order.state} />
        <span className="muted">
          {isPayer ? 'You are the buyer (payer)' : isPayee ? 'You are the seller (payee)' : 'Viewing escrow'}
        </span>
        {order.termsVersion > 0 && <span className="muted">Terms v{order.termsVersion}</span>}
      </div>

      {feedback && (
        <div className="alert alert-success" role="status">
          <CheckCircle2 size={18} aria-hidden="true" />
          <div><p>{feedback}</p></div>
        </div>
      )}
      {actionError && <ErrorBanner message={actionError} />}

      <div className="detail-grid">
        <div className="detail-main">
          <Card title="Agreement">
            {latestTerms ? (
              <>
                <div className="agreement-head">
                  <div>
                    <span className="agreement-version">Version {latestTerms.version ?? order.termsVersion}</span>
                    <span className="muted">
                      {DELIVERY_LABELS[latestTerms.deliveryMode] ?? latestTerms.deliveryMode}
                    </span>
                  </div>
                  {latestTerms.hash && (
                    <span className="hash" title={latestTerms.hash}>
                      Hash {latestTerms.hash.slice(0, 12)}…
                    </span>
                  )}
                </div>

                <div className="agreement-scope">
                  <h3>Scope</h3>
                  <p>{latestTerms.scopeDescription}</p>
                </div>

                {latestTerms.extraTerms && (
                  <div className="agreement-scope">
                    <h3>Additional terms</h3>
                    <p>{latestTerms.extraTerms}</p>
                  </div>
                )}

                <div className="acceptance-row">
                  <div className={`acceptance ${buyerAccepted ? 'accepted' : ''}`}>
                    <span className="acceptance-party">
                      {displayNameFor(order.payerId, sessions)} · Buyer
                    </span>
                    <span>{buyerAccepted ? `Accepted ${formatDate(buyerAccepted.acceptedAt)}` : 'Not accepted yet'}</span>
                  </div>
                  <div className={`acceptance ${sellerAccepted ? 'accepted' : ''}`}>
                    <span className="acceptance-party">
                      {displayNameFor(order.payeeId, sessions)} · Seller
                    </span>
                    <span>{sellerAccepted ? `Accepted ${formatDate(sellerAccepted.acceptedAt)}` : 'Not accepted yet'}</span>
                  </div>
                </div>

                <p className="form-note">
                  Both parties accept a specific version. Changing terms creates a new version and
                  clears previous acceptances.
                </p>
              </>
            ) : (
              <p className="muted">No terms have been set. The seller needs to add the agreement terms.</p>
            )}
          </Card>

          <Card title="Transaction timeline">
            <TransactionTimeline order={order} />
          </Card>
        </div>

        <aside className="detail-side">
          <Card title="Payment summary">
            <dl className="money-list">
              <div><dt>Escrow amount</dt><dd>{money(order.priceCents)}</dd></div>
              <div><dt>Call-out fee</dt><dd>{money(order.calloutFeeCents)}</dd></div>
              <div><dt>Platform fee</dt><dd>{order.feeCents != null ? money(order.feeCents) : 'Assessed at acceptance'}</dd></div>
              <div className="money-total"><dt>Total payable</dt><dd>{money(total)}</dd></div>
            </dl>
            <p className="form-note">
              The buyer pays the total into escrow. The seller receives the escrow amount minus the
              platform fee after release.
            </p>
          </Card>

          <Card title="Participants">
            <dl className="detail-list">
              <div><dt>Buyer</dt><dd>{displayNameFor(order.payerId, sessions)}</dd></div>
              <div><dt>Seller</dt><dd>{displayNameFor(order.payeeId, sessions)}</dd></div>
              <div><dt>Escrow reference</dt><dd className="mono">{reference(order.id)}</dd></div>
            </dl>
          </Card>

          <Card title="Key dates">
            <dl className="detail-list">
              <div><dt><CalendarClock size={14} /> Created</dt><dd>{formatDateTime(order.createdAt)}</dd></div>
              <div>
                <dt><Clock3 size={14} /> Funding deadline</dt>
                <dd className={order.fundingDeadline && isOverdue(order.fundingDeadline) && order.state === 'ACCEPTED' ? 'deadline-overdue' : ''}>
                  {formatDateTime(order.fundingDeadline)}
                </dd>
              </div>
              <div><dt><Clock3 size={14} /> Review deadline</dt><dd>{formatDateTime(order.reviewDeadline)}</dd></div>
              <div><dt><Smartphone size={14} /> Paid</dt><dd>{formatDateTime(order.paidAt)}</dd></div>
              <div><dt><ShieldCheck size={14} /> Released</dt><dd>{formatDateTime(order.releasedAt)}</dd></div>
            </dl>
          </Card>

          <Card title="Payment status">
            <p className={`payment-state ${meta.tone}`}>
              {order.state === 'ACCEPTED'
                ? 'Awaiting payment'
                : ['CANCELLED'].includes(order.state)
                  ? 'Not funded'
                  : order.state === 'REFUNDED'
                    ? 'Refunded to buyer'
                    : 'Held in escrow'}
            </p>
            <p className="form-note">
              This reflects the escrow record. Individual M-Pesa receipt numbers are not exposed by
              this API version.
            </p>
          </Card>
        </aside>
      </div>

      <ConfirmDialog
        open={dialog === 'cancel'}
        title="Cancel this escrow?"
        description="Cancelling closes the agreement. This cannot be undone, and any accepted terms become void."
        confirmLabel="Cancel escrow"
        tone="danger"
        busy={busy}
        onConfirm={() => void execute('cancel')}
        onClose={() => setDialog(null)}
      />

      <ConfirmDialog
        open={dialog === 'release'}
        title="Release funds to the seller?"
        description={`Releasing sends ${money(order.priceCents)} (minus the platform fee) to the seller. This is final and cannot be reversed.`}
        confirmLabel="Release funds"
        busy={busy}
        onConfirm={() => void execute('release')}
        onClose={() => setDialog(null)}
      />

      <TermsModal
        open={termsOpen}
        order={order}
        latest={latestTerms}
        onClose={() => setTermsOpen(false)}
        onSaved={async () => {
          setTermsOpen(false);
          setFeedback('Agreement terms updated. The buyer must accept the new version.');
          await load();
          await refresh();
        }}
        onError={(message) => setActionError(message)}
      />

      <DisputeModal
        open={disputeOpen}
        order={order}
        onClose={() => setDisputeOpen(false)}
        onOpened={async () => {
          setDisputeOpen(false);
          setFeedback('Dispute opened. Funds remain held while support reviews the case.');
          await load();
          await refresh();
        }}
        onError={(message) => setActionError(message)}
      />

      <FundModal
        open={fundOpen}
        order={order}
        onClose={() => setFundOpen(false)}
        onConfirmed={async () => {
          setFundOpen(false);
          setFeedback('Payment confirmed. The seller can begin work.');
          await load();
          await refresh();
        }}
      />
    </>
  );
}

/* ─── Terms editor ──────────────────────────────────────────────────────── */

function TermsModal({
  open,
  order,
  latest,
  onClose,
  onSaved,
  onError,
}: {
  open: boolean;
  order: OrderDetail;
  latest: { priceCents: number; calloutFeeCents: number; scopeDescription: string; deliveryMode: string; extraTerms?: string | null } | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const [price, setPrice] = useState('');
  const [callout, setCallout] = useState('');
  const [scope, setScope] = useState('');
  const [delivery, setDelivery] = useState('digital');
  const [extra, setExtra] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPrice(((latest?.priceCents ?? order.priceCents ?? 0) / 100).toFixed(2));
    setCallout(((latest?.calloutFeeCents ?? order.calloutFeeCents ?? 0) / 100).toFixed(2));
    setScope(latest?.scopeDescription ?? '');
    setDelivery(latest?.deliveryMode ?? order.deliveryMode ?? 'digital');
    setExtra(latest?.extraTerms ?? '');
  }, [open, latest, order]);

  async function save() {
    if (!scope.trim()) {
      onError('Scope description is required.');
      return;
    }
    setBusy(true);
    try {
      await api(`/api/orders/${order.id}/terms`, {
        method: 'PUT',
        body: {
          priceCents: Math.round(Number(price) * 100),
          calloutFeeCents: Math.max(0, Math.round(Number(callout || 0) * 100)),
          scopeDescription: scope.trim(),
          deliveryMode: delivery,
          extraTerms: extra.trim() || undefined,
        },
      });
      await onSaved();
    } catch (err) {
      onError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      title="Edit agreement terms"
      description="Saving creates a new terms version. The buyer must accept it before funding."
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={() => void save()} disabled={busy}>
            {busy ? <Spinner label="Saving…" /> : 'Save terms'}
          </button>
        </>
      }
    >
      <div className="field-row">
        <Field label="Escrow amount (KES)">
          <input type="number" min="1" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
        </Field>
        <Field label="Call-out fee (KES)">
          <input type="number" min="0" step="0.01" value={callout} onChange={(e) => setCallout(e.target.value)} />
        </Field>
      </div>
      <Field label="Scope">
        <textarea rows={3} value={scope} onChange={(e) => setScope(e.target.value)} />
      </Field>
      <Field label="Delivery mode">
        <select value={delivery} onChange={(e) => setDelivery(e.target.value)}>
          {Object.entries(DELIVERY_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </Field>
      <Field label="Additional terms">
        <textarea rows={2} value={extra} onChange={(e) => setExtra(e.target.value)} />
      </Field>
    </Modal>
  );
}

/* ─── Dispute ───────────────────────────────────────────────────────────── */

function DisputeModal({
  open,
  order,
  onClose,
  onOpened,
  onError,
}: {
  open: boolean;
  order: OrderDetail;
  onClose: () => void;
  onOpened: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const [reason, setReason] = useState<string>(DISPUTE_REASONS[0]);
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!description.trim()) {
      onError('Describe what went wrong before opening a dispute.');
      return;
    }
    setBusy(true);
    try {
      await api(`/api/disputes/${order.id}`, {
        method: 'POST',
        body: { reason, description: description.trim() },
      });
      await onOpened();
      setDescription('');
    } catch (err) {
      onError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      title="Open a dispute"
      description="Funds stay held while support reviews the case. Both parties will see the dispute."
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="button" className="btn btn-danger" onClick={() => void submit()} disabled={busy}>
            {busy ? <Spinner label="Opening…" /> : 'Open dispute'}
          </button>
        </>
      }
    >
      <div className="alert alert-warning">
        <TriangleAlert size={18} aria-hidden="true" />
        <div><p>Only open a dispute if the issue cannot be resolved directly with the other party.</p></div>
      </div>
      <Field label="Reason">
        <select value={reason} onChange={(e) => setReason(e.target.value)}>
          {DISPUTE_REASONS.map((value) => (
            <option key={value} value={value}>{humanise(value)}</option>
          ))}
        </select>
      </Field>
      <Field label="What happened?">
        <textarea
          rows={4}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe what was agreed, what went wrong and any evidence you have."
        />
      </Field>
      <p className="form-note">Evidence upload is not available in this API version; support will request documents through the support channel.</p>
    </Modal>
  );
}

/* ─── M-Pesa funding ────────────────────────────────────────────────────── */

function FundModal({
  open,
  order,
  onClose,
  onConfirmed,
}: {
  open: boolean;
  order: OrderDetail;
  onClose: () => void;
  onConfirmed: () => Promise<void>;
}) {
  const [stage, setStage] = useState<FundStage>('idle');
  const [checkout, setCheckout] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const cancelled = useRef(false);

  useEffect(() => {
    if (open) {
      setStage('idle');
      setCheckout(null);
      setMessage(null);
      cancelled.current = false;
    }
  }, [open]);

  async function start() {
    setStage('starting');
    setMessage(null);
    try {
      const result = await api<{ checkoutRequestId: string }>(`/api/payments/fund/${order.id}`, {
        method: 'POST',
        idempotencyKey: newIdempotencyKey(),
      });
      setCheckout(result.checkoutRequestId);
      setStage('waiting');

      for (let attempt = 0; attempt < STK_PROMPT_TIMEOUT_SECONDS * 1000 / STK_POLL_INTERVAL_MS; attempt += 1) {
        if (cancelled.current) return;
        await sleep(STK_POLL_INTERVAL_MS);
        if (attempt > 0 && attempt % 5 === 0) {
          try {
            const reconciliation = await api<{ reconciled: boolean; state: string }>(
              `/api/payments/reconcile/${order.id}`,
              { method: 'POST', quiet: true },
            );
            if (reconciliation.state === 'FUNDED') {
              setStage('confirmed');
              await onConfirmed();
              return;
            }
          } catch {
            // Fall back to the existing order refresh below.
          }
        }
        const fresh = await api<OrderDetail>(`/api/orders/${order.id}`, { quiet: true });
        if (fresh.state === 'FUNDED') {
          setStage('confirmed');
          await onConfirmed();
          return;
        }
      }
      setStage('timeout');
    } catch (err) {
      setStage('error');
      setMessage((err as Error).message);
    }
  }

  const total = (order.priceCents ?? 0) + (order.calloutFeeCents ?? 0);
  const close = () => {
    cancelled.current = true;
    onClose();
  };

  return (
    <Modal
      open={open}
      title="Fund escrow with M-Pesa"
      description="An STK Push is sent to the phone number on your account."
      onClose={close}
      footer={
        <>
          {stage === 'confirmed' ? (
            <button type="button" className="btn btn-primary" onClick={close}>Done</button>
          ) : stage === 'timeout' || stage === 'error' ? (
            <>
              <button type="button" className="btn btn-secondary" onClick={close}>Close</button>
              <button type="button" className="btn btn-primary" onClick={() => void start()}>Try again</button>
            </>
          ) : (
            <>
              <button type="button" className="btn btn-secondary" onClick={close} disabled={stage === 'starting' || stage === 'waiting'}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary" onClick={() => void start()} disabled={stage === 'starting' || stage === 'waiting'}>
                {stage === 'starting' ? <Spinner label="Sending…" /> : stage === 'waiting' ? 'Waiting…' : `Send ${money(total)} request`}
              </button>
            </>
          )}
        </>
      }
    >
      <div className="fund-summary">
        <span>Amount to fund</span>
        <strong>{money(total)}</strong>
        <span>Reference</span>
        <strong className="mono">{reference(order.id)}</strong>
      </div>

      {stage === 'idle' && (
        <div className="alert alert-info">
          <Info size={18} aria-hidden="true" />
          <div>
            <strong>A push notification will arrive on your phone</strong>
            <p>Enter your M-Pesa PIN to approve. A request alone is not proof of payment.</p>
          </div>
        </div>
      )}

      {stage === 'starting' && <Spinner label="Sending STK Push…" />}

      {stage === 'waiting' && (
        <div className="waiting-panel">
          <Spinner label="Waiting for M-Pesa confirmation…" />
          <p>
            Check your phone and enter your PIN. We will confirm automatically once the M-Pesa
            callback is verified.
          </p>
          {checkout && <p className="mono muted">Checkout {checkout}</p>}
        </div>
      )}

      {stage === 'confirmed' && (
        <div className="alert alert-success" role="status">
          <CheckCircle2 size={18} aria-hidden="true" />
          <div><strong>Payment confirmed</strong><p>The escrow is funded and the seller can begin work.</p></div>
        </div>
      )}

      {stage === 'timeout' && (
        <div className="alert alert-warning">
          <Clock3 size={18} aria-hidden="true" />
          <div>
            <strong>No confirmation yet</strong>
            <p>
              The payment has not been confirmed by M-Pesa. Check your phone or wait a moment and
              try again. The prompt was cancelled after {STK_PROMPT_TIMEOUT_SECONDS} seconds. Do
              not send a second payment until this request has expired.
            </p>
          </div>
        </div>
      )}

      {stage === 'error' && message && <ErrorBanner message={message} />}

      <p className="form-note">
        Your escrow status is the source of truth. This screen does not mark the escrow as funded;
        only a verified backend callback can.
      </p>
    </Modal>
  );
}
