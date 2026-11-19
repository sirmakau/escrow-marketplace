import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Info,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import { api } from '../api';
import {
  Card,
  ErrorBanner,
  Field,
  Notice,
  PageHeader,
  Spinner,
  Steps,
} from '../components/ui';
import { money, reference } from '../format';
import { useEscrows } from '../lib/escrows';
import { DELIVERY_LABELS } from '../lib/status';
import type { Order } from '../types';

const STEPS = ['Participants', 'Agreement', 'Review', 'Confirmation'];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function CreateEscrow() {
  const { user, refresh } = useEscrows();
  const navigate = useNavigate();

  const [step, setStep] = useState(0);
  const [payerId, setPayerId] = useState('');
  const [scope, setScope] = useState('');
  const [price, setPrice] = useState('');
  const [callout, setCallout] = useState('');
  const [delivery, setDelivery] = useState('digital');
  const [extra, setExtra] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<Order | null>(null);

  const canCreate = (user?.kycTier ?? 0) >= 1;
  const priceCents = Math.round(Number(price || 0) * 100);
  const calloutCents = Math.round(Number(callout || 0) * 100);
  const total = priceCents + calloutCents;

  function next() {
    setError(null);
    if (step === 0) {
      if (!UUID_RE.test(payerId.trim())) {
        setError('Enter the buyer’s account ID (UUID). Participant lookup is not available yet.');
        return;
      }
      if (payerId.trim() === user?.id) {
        setError('The buyer and seller must be different accounts.');
        return;
      }
    }
    if (step === 1) {
      if (!Number.isFinite(priceCents) || priceCents <= 0) {
        setError('Enter an escrow amount greater than zero.');
        return;
      }
      if (!scope.trim()) {
        setError('Describe what the seller is delivering.');
        return;
      }
    }
    setStep((current) => Math.min(current + 1, STEPS.length - 1));
  }

  function back() {
    setError(null);
    setStep((current) => Math.max(current - 1, 0));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!confirmed || !canCreate) return;
    setBusy(true);
    setError(null);
    let order: Order | null = null;
    try {
      order = await api<Order>('/api/orders', {
        method: 'POST',
        body: { payerId: payerId.trim() },
      });
      setCreated(order);
      await api(`/api/orders/${order.id}/terms`, {
        method: 'PUT',
        body: {
          priceCents,
          calloutFeeCents: calloutCents,
          scopeDescription: scope.trim(),
          deliveryMode: delivery,
          extraTerms: extra.trim() || undefined,
        },
      });
      await api(`/api/orders/${order.id}/propose`, { method: 'POST' });
      await refresh();
    } catch (err) {
      setError(
        order
          ? `Escrow ${reference(order.id)} was created, but the next step failed: ${(err as Error).message}`
          : (err as Error).message,
      );
    } finally {
      setBusy(false);
    }
  }

  if (created && !busy && !error) {
    return (
      <>
        <PageHeader title="Escrow proposed" description="The buyer has been invited to review and accept the agreement." />
        <Card>
          <div className="success-panel">
            <span className="success-icon"><CheckCircle2 size={28} /></span>
            <h2>{reference(created.id)}</h2>
            <p>
              {money(total)} is not funded yet. The buyer must accept version 1 of the terms, then
              pay into escrow. Funds are held until the buyer confirms delivery.
            </p>
            <div className="success-actions">
              <button type="button" className="btn btn-primary" onClick={() => navigate(`/escrows/${created.id}`)}>
                View escrow
              </button>
              <Link to="/escrows" className="btn btn-secondary">Back to my escrows</Link>
            </div>
          </div>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Create Escrow"
        description="Agree the scope and price, then invite the buyer to accept and fund."
      />

      <Card>
        <Steps steps={STEPS} current={step} />

        {!canCreate && (
          <Notice tone="warning" title="Verification required">
            Creating escrows requires verification tier 1. Your account is tier {user?.kycTier ?? 0}.{' '}
            <Link to="/profile">View verification</Link>.
          </Notice>
        )}

        {error && <ErrorBanner message={error} />}

        <form onSubmit={submit} className="create-form">
          {step === 0 && (
            <div className="form-section">
              <h2>Who is involved?</h2>
              <p className="section-sub">
                You are the seller (payee). The buyer (payer) must already have an Escrow account.
              </p>

              <div className="participant-grid">
                <div className="participant-card">
                  <span className="participant-role">Seller · you</span>
                  <strong>{user?.displayName ?? '—'}</strong>
                  <span className="muted">{user?.phone}</span>
                </div>
                <div className="participant-card muted-card">
                  <span className="participant-role">Buyer · payer</span>
                  <strong>{payerId ? payerId.slice(0, 8) + '…' : 'Not selected'}</strong>
                  <span className="muted">Account lookup pending</span>
                </div>
              </div>

              <Field
                label="Buyer account ID"
                hint="Participant search by phone is not exposed by this API version. Enter the buyer’s account ID."
              >
                <input
                  value={payerId}
                  onChange={(e) => setPayerId(e.target.value)}
                  placeholder="00000000-0000-0000-0000-000000000000"
                  spellCheck={false}
                  required
                />
              </Field>

              <Notice tone="info">
                Roles belong to the escrow, not the account. The same person can be a buyer on one
                escrow and a seller on another.
              </Notice>
            </div>
          )}

          {step === 1 && (
            <div className="form-section">
              <h2>Agreement terms</h2>
              <p className="section-sub">
                These terms are versioned. Any change creates a new version that the buyer must
                accept again.
              </p>

              <Field label="Scope of work">
                <textarea
                  value={scope}
                  onChange={(e) => setScope(e.target.value)}
                  rows={4}
                  placeholder="Describe exactly what will be delivered and what counts as complete."
                  required
                />
              </Field>

              <div className="field-row">
                <Field label="Escrow amount (KES)">
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="10000.00"
                    required
                  />
                </Field>
                <Field label="Call-out fee (KES)" hint="Optional. Set to 0 if not applicable.">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={callout}
                    onChange={(e) => setCallout(e.target.value)}
                    placeholder="0.00"
                  />
                </Field>
              </div>

              <Field label="Delivery mode">
                <select value={delivery} onChange={(e) => setDelivery(e.target.value)}>
                  {Object.entries(DELIVERY_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </Field>

              <Field label="Additional terms" hint="Optional. Deadlines, handover details or exclusions.">
                <textarea
                  value={extra}
                  onChange={(e) => setExtra(e.target.value)}
                  rows={3}
                  placeholder="Anything else both parties should know."
                />
              </Field>
            </div>
          )}

          {step === 2 && (
            <div className="form-section">
              <h2>Review the agreement</h2>
              <p className="section-sub">Check the details the buyer will accept.</p>

              <dl className="review-list">
                <div><dt>Seller</dt><dd>{user?.displayName}</dd></div>
                <div><dt>Buyer account</dt><dd className="mono">{payerId}</dd></div>
                <div><dt>Scope</dt><dd>{scope}</dd></div>
                <div><dt>Delivery</dt><dd>{DELIVERY_LABELS[delivery] ?? delivery}</dd></div>
                <div><dt>Escrow amount</dt><dd>{money(priceCents)}</dd></div>
                <div><dt>Call-out fee</dt><dd>{money(calloutCents)}</dd></div>
                <div className="review-total"><dt>Total payable</dt><dd>{money(total)}</dd></div>
                <div>
                  <dt>Platform fee</dt>
                  <dd className="muted">Calculated by the platform when the buyer accepts.</dd>
                </div>
                {extra && <div><dt>Additional terms</dt><dd>{extra}</dd></div>}
              </dl>

              <div className="alert alert-info">
                <Info size={18} aria-hidden="true" />
                <div>
                  <strong>Who pays and when</strong>
                  <p>
                    The buyer pays the total into escrow. The seller receives the escrow amount
                    (minus the platform fee) only after the buyer confirms delivery.
                  </p>
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="form-section">
              <h2>Confirm and propose</h2>
              <p className="section-sub">
                You are creating version 1 of the agreement. The buyer must accept it before any
                money moves.
              </p>

              <div className="summary-panel">
                <div>
                  <span>Reference</span>
                  <strong>Created on submit</strong>
                </div>
                <div>
                  <span>Total payable by buyer</span>
                  <strong>{money(total)}</strong>
                </div>
                <div>
                  <span>Funds released</span>
                  <strong>After buyer confirmation</strong>
                </div>
              </div>

              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                  required
                />
                <span>
                  I confirm the scope and price are correct, and I understand funds remain held
                  until the buyer confirms delivery or a dispute is resolved.
                </span>
              </label>

              <div className="alert alert-warning">
                <ShieldCheck size={18} aria-hidden="true" />
                <div>
                  <strong>You cannot release funds</strong>
                  <p>Only the buyer can release. If the buyer does not respond, open a dispute.</p>
                </div>
              </div>
            </div>
          )}

          <div className="wizard-actions">
            {step > 0 ? (
              <button type="button" className="btn btn-secondary" onClick={back} disabled={busy}>
                <ArrowLeft size={16} /> Back
              </button>
            ) : (
              <span />
            )}

            {step < STEPS.length - 1 ? (
              <button type="button" className="btn btn-primary" onClick={next}>
                Continue <ArrowRight size={16} />
              </button>
            ) : (
              <button type="submit" className="btn btn-primary" disabled={!confirmed || busy || !canCreate}>
                {busy ? <Spinner label="Creating escrow…" /> : 'Create and propose'}
              </button>
            )}
          </div>
        </form>
      </Card>

      <div className="create-aside">
        <UserRound size={16} aria-hidden="true" />
        <p>
          The buyer must already be registered. If you only know their phone number, ask them to
          share their account ID until participant lookup is available.
        </p>
      </div>
    </>
  );
}
