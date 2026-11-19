import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { api, apiUrl, refreshProfile, signIn, signOut } from './api';
import { displayNameFor, money, sleep } from './format';
import {
  activeSession,
  addLog,
  clearLogs,
  setActivePhone,
  useAppState,
  useLogs,
} from './store';
import type {
  DashboardStats,
  Dispute,
  Order,
  OrderDetail,
  Session,
  TermsVersion,
} from './types';

type FlashKind = 'ok' | 'error';
type Flash = { message: string; kind: FlashKind } | null;

interface FlashApi {
  flash: Flash;
  showFlash: (message: string, kind?: FlashKind) => void;
}

/* ─── App shell ─────────────────────────────────────────────────────────── */

export function App() {
  const { sessions, activePhone } = useAppState();
  const active = activeSession(sessions, activePhone);
  const logs = useLogs();

  const [orders, setOrders] = useState<Order[]>([]);
  const [flash, setFlash] = useState<Flash>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [health, setHealth] = useState('checking…');
  const [adminRefresh, setAdminRefresh] = useState(0);
  const flashTimer = useRef<number | undefined>(undefined);

  const showFlash = useCallback((message: string, kind: FlashKind = 'ok') => {
    setFlash({ message, kind });
    window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setFlash(null), 5000);
  }, []);

  useEffect(() => () => window.clearTimeout(flashTimer.current), []);

  const loadOrders = useCallback(async () => {
    const session = activeSession();
    if (!session) {
      setOrders([]);
      return;
    }
    try {
      const result = await api<{ items: Order[] }>('/api/orders?limit=50', { quiet: true });
      setOrders(Array.isArray(result?.items) ? result.items : []);
    } catch (err) {
      setOrders([]);
      showFlash((err as Error).message, 'error');
    }
  }, [showFlash]);

  const refreshAll = useCallback(async () => {
    await refreshProfile();
    await loadOrders();
    setAdminRefresh((n) => n + 1);
  }, [loadOrders]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (active) {
        await refreshProfile();
        if (cancelled) return;
        await loadOrders();
      } else {
        setOrders([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activePhone, active, loadOrders]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(apiUrl('/health'));
        const body = await res.json();
        setHealth(`${body.status} · ${body.mode} mode`);
      } catch {
        setHealth('unreachable');
      }
    })();
  }, []);

  const runOrderAction = useCallback(
    async (orderId: string, handler: () => Promise<unknown>) => {
      setBusyId(orderId);
      try {
        await handler();
        await refreshAll();
      } catch (err) {
        showFlash((err as Error).message, 'error');
      } finally {
        setBusyId(null);
      }
    },
    [refreshAll, showFlash],
  );

  const isStaff = active?.user?.role === 'admin' || active?.user?.role === 'support';

  return (
    <>
      <Header session={active} health={health} />

      <main className="layout">
        <aside className="sidebar">
          <LoginCard onSignedIn={refreshAll} showFlash={showFlash} />
          <SessionsCard session={active} onSignedOut={refreshAll} showFlash={showFlash} />
          {active && (
            <CreateCard
              session={active}
              sessions={sessions}
              onCreated={refreshAll}
              showFlash={showFlash}
            />
          )}
          {active && isStaff && (
            <AdminCard
              session={active}
              refreshKey={adminRefresh}
              onChanged={refreshAll}
              showFlash={showFlash}
            />
          )}
        </aside>

        <OrdersPanel
          session={active}
          sessions={sessions}
          orders={orders}
          busyId={busyId}
          onRefresh={refreshAll}
          onAction={runOrderAction}
          showFlash={showFlash}
        />
      </main>

      <ActivityLog logs={logs} />

      {flash && (
        <div className={`flash ${flash.kind}`} role="status" aria-live="polite">
          {flash.message}
        </div>
      )}
    </>
  );
}

/* ─── Header ────────────────────────────────────────────────────────────── */

function Header({ session, health }: { session: Session | null; health: string }) {
  return (
    <header className="topbar">
      <div className="brand">
        <span className="logo" aria-hidden="true">◈</span>
        <div>
          <h1>Escrow Test Console</h1>
          <p className="sub">
            Local API · <span id="health">{health}</span>
          </p>
        </div>
      </div>
      <div className="who">
        <span className="who-name">{session?.user?.displayName ?? 'Not signed in'}</span>
        {session?.user && <span className="pill">{session.user.role}</span>}
        {session?.user && (
          <span className="wallet">{money(session.user.wallet?.balance ?? 0)}</span>
        )}
      </div>
    </header>
  );
}

/* ─── Login & sessions ──────────────────────────────────────────────────── */

const QUICK_ACCOUNTS = [
  { phone: '+254712345678', label: 'Alice', role: 'payer · KYC 1' },
  { phone: '+254798765432', label: 'Bob', role: 'payee · KYC 1' },
  { phone: '+254700000002', label: 'Support', role: 'resolves disputes' },
  { phone: '+254700000001', label: 'Admin', role: 'full access' },
];

function LoginCard({ onSignedIn, showFlash }: { onSignedIn: () => Promise<void> } & Pick<FlashApi, 'showFlash'>) {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const attempt = useCallback(
    async (loginPhone: string, loginPassword: string) => {
      setSubmitting(true);
      try {
        const user = await signIn(loginPhone, loginPassword);
        setPassword('');
        showFlash(`Signed in as ${user.displayName}`, 'ok');
        await onSignedIn();
      } catch (err) {
        addLog('err', `Sign-in failed — ${(err as Error).message}`);
        showFlash((err as Error).message, 'error');
      } finally {
        setSubmitting(false);
      }
    },
    [onSignedIn, showFlash],
  );

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void attempt(phone, password);
  }

  return (
    <section className="card">
      <h2>Sign in</h2>
      <form onSubmit={onSubmit}>
        <label>
          Phone
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+254712345678"
            autoComplete="username"
            required
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="password123"
            autoComplete="current-password"
            required
          />
        </label>
        <button className="primary full" type="submit" disabled={submitting}>
          Sign in
        </button>
      </form>
      <div className="quick" role="group" aria-label="Seeded accounts">
        {QUICK_ACCOUNTS.map((account) => (
          <button
            key={account.phone}
            type="button"
            disabled={submitting}
            onClick={() => {
              setPhone(account.phone);
              setPassword('password123');
              void attempt(account.phone, 'password123');
            }}
          >
            {account.label}
            <span className="role">{account.role}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function SessionsCard({
  session,
  onSignedOut,
  showFlash,
}: {
  session: Session | null;
  onSignedOut: () => Promise<void>;
} & Pick<FlashApi, 'showFlash'>) {
  const { sessions } = useAppState();

  async function handleSignOut(target: Session) {
    try {
      await signOut(target);
      await onSignedOut();
      showFlash(`Signed out ${target.user?.displayName || target.phone}`, 'ok');
    } catch (err) {
      showFlash((err as Error).message, 'error');
    }
  }

  return (
    <section className="card">
      <h2>
        Accounts <span className="count">{sessions.length}</span>
      </h2>
      <ul className="sessions">
        {sessions.length === 0 && <li className="empty">No accounts signed in.</li>}
        {sessions.map((item) => (
          <li
            key={item.phone}
            className={`session${item.phone === session?.phone ? ' active' : ''}`}
          >
            <button
              type="button"
              className="session-main"
              disabled={item.phone === session?.phone}
              title={item.phone === session?.phone ? 'Active account' : 'Act as this account'}
              onClick={() => setActivePhone(item.phone)}
            >
              <span className="session-name">{item.user?.displayName || item.phone}</span>
              <span className="session-meta">
                {item.user?.role || 'user'} · {item.phone}
              </span>
            </button>
            <button
              type="button"
              className="icon"
              title="Sign out"
              aria-label={`Sign out ${item.phone}`}
              onClick={() => void handleSignOut(item)}
            >
              ×
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ─── Create order ──────────────────────────────────────────────────────── */

function CreateCard({
  session,
  sessions,
  onCreated,
  showFlash,
}: {
  session: Session;
  sessions: Session[];
  onCreated: () => Promise<void>;
} & Pick<FlashApi, 'showFlash'>) {
  const candidates = sessions.filter((s) => s.user && s.user.id !== session.user?.id);
  const [payerId, setPayerId] = useState(candidates[0]?.user?.id ?? '');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!candidates.some((c) => c.user?.id === payerId)) {
      setPayerId(candidates[0]?.user?.id ?? '');
    }
  }, [candidates, payerId]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!payerId) {
      showFlash('Sign in a payer account first', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const order = await api<Order>('/api/orders', { method: 'POST', body: { payerId } });
      addLog('info', `Created order #${order.id.slice(0, 8)} as payee`);
      await onCreated();
    } catch (err) {
      showFlash((err as Error).message, 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="card">
      <h2>Create order</h2>
      <form onSubmit={onSubmit}>
        <label>
          Payer
          <select
            value={candidates.length === 0 ? '' : payerId}
            onChange={(e) => setPayerId(e.target.value)}
            disabled={candidates.length === 0}
          >
            {candidates.length === 0 ? (
              <option value="">Sign in a second account first</option>
            ) : (
              candidates.map((candidate) => (
                <option key={candidate.user!.id} value={candidate.user!.id}>
                  {candidate.user!.displayName} ({candidate.phone})
                </option>
              ))
            )}
          </select>
        </label>
        <button
          className="primary full"
          type="submit"
          disabled={submitting || candidates.length === 0}
        >
          Create draft
        </button>
      </form>
      <p className="hint">You act as the payee. Sign in a second account to choose a payer.</p>
    </section>
  );
}

/* ─── Orders ────────────────────────────────────────────────────────────── */

function OrdersPanel({
  session,
  sessions,
  orders,
  busyId,
  onRefresh,
  onAction,
  showFlash,
}: {
  session: Session | null;
  sessions: Session[];
  orders: Order[];
  busyId: string | null;
  onRefresh: () => Promise<void>;
  onAction: (orderId: string, handler: () => Promise<unknown>) => Promise<void>;
} & Pick<FlashApi, 'showFlash'>) {
  const sorted = [...orders].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return (
    <section className="content">
      <div className="content-head">
        <h2>Orders</h2>
        <div className="tools">
          <button className="small" type="button" onClick={() => void onRefresh()}>
            Refresh
          </button>
        </div>
      </div>
      <div className="orders">
        {!session && <p className="empty">Sign in to see orders.</p>}
        {session && sorted.length === 0 && (
          <p className="empty">No orders yet. Create one on the left.</p>
        )}
        {session &&
          sorted.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              session={session}
              sessions={sessions}
              busy={busyId === order.id}
              onAction={onAction}
              showFlash={showFlash}
            />
          ))}
      </div>
    </section>
  );
}

function OrderCard({
  order,
  session,
  sessions,
  busy,
  onAction,
  showFlash,
}: {
  order: Order;
  session: Session;
  sessions: Session[];
  busy: boolean;
  onAction: (orderId: string, handler: () => Promise<unknown>) => Promise<void>;
} & Pick<FlashApi, 'showFlash'>) {
  const [mode, setMode] = useState<'terms' | 'dispute' | null>(null);
  const [detail, setDetail] = useState<OrderDetail | null>(null);

  const uid = session.user?.id;
  const isPayer = order.payerId === uid;
  const isPayee = order.payeeId === uid;

  const run = (handler: () => Promise<unknown>) => onAction(order.id, handler);

  const openTerms = async () => {
    setMode('terms');
    setDetail(null);
    try {
      setDetail(await api<OrderDetail>(`/api/orders/${order.id}`, { quiet: true }));
    } catch {
      /* fall back to an empty form */
    }
  };

  const actions: ReactNode[] = [];
  if (isPayer || isPayee) {
    switch (order.state) {
      case 'DRAFT':
        if (isPayee) {
          actions.push(
            <button key="terms" type="button" className="small primary" onClick={() => void openTerms()}>
              Set terms
            </button>,
            <button
              key="propose"
              type="button"
              className="small"
              onClick={() => void run(() => api(`/api/orders/${order.id}/propose`, { method: 'POST' }))}
            >
              Propose
            </button>,
            <button
              key="cancel"
              type="button"
              className="small danger"
              onClick={() => void run(() => api(`/api/orders/${order.id}/cancel`, { method: 'POST' }))}
            >
              Cancel
            </button>,
          );
        }
        break;

      case 'PROPOSED':
        if (isPayee) {
          actions.push(
            <button key="terms" type="button" className="small primary" onClick={() => void openTerms()}>
              Revise terms
            </button>,
          );
        }
        if (isPayer) {
          if (order.termsVersion > 0) {
            actions.push(
              <button
                key="accept"
                type="button"
                className="small primary"
                onClick={() =>
                  void run(() =>
                    api(`/api/orders/${order.id}/accept`, {
                      method: 'POST',
                      body: { termsVersion: order.termsVersion },
                    }),
                  )
                }
              >
                Accept v{order.termsVersion}
              </button>,
            );
          }
          actions.push(
            <button
              key="cancel"
              type="button"
              className="small danger"
              onClick={() => void run(() => api(`/api/orders/${order.id}/cancel`, { method: 'POST' }))}
            >
              Cancel
            </button>,
          );
        }
        break;

      case 'ACCEPTED':
        if (isPayer) {
          actions.push(
            <button
              key="fund"
              type="button"
              className="small primary"
              onClick={() =>
                void run(async () => {
                  const result = await api<{ checkoutRequestId: string }>(
                    `/api/payments/fund/${order.id}`,
                    { method: 'POST' },
                  );
                  addLog('info', `STK push ${result.checkoutRequestId} sent — mock callback arrives in ~2s`);
                  showFlash('STK push sent. Waiting for the mock M-Pesa callback…', 'ok');
                  await sleep(3000);
                })
              }
            >
              Fund (mock STK)
            </button>,
            <button
              key="cancel"
              type="button"
              className="small danger"
              onClick={() => void run(() => api(`/api/orders/${order.id}/cancel`, { method: 'POST' }))}
            >
              Cancel
            </button>,
          );
        }
        break;

      case 'FUNDED':
        actions.push(
          <button
            key="start"
            type="button"
            className="small primary"
            onClick={() => void run(() => api(`/api/orders/${order.id}/start`, { method: 'POST' }))}
          >
            Start work
          </button>,
          <button key="dispute" type="button" className="small" onClick={() => setMode('dispute')}>
            Open dispute
          </button>,
        );
        break;

      case 'IN_PROGRESS':
        if (isPayee) {
          actions.push(
            <button
              key="deliver"
              type="button"
              className="small primary"
              onClick={() => void run(() => api(`/api/orders/${order.id}/deliver`, { method: 'POST' }))}
            >
              Mark delivered
            </button>,
          );
        }
        actions.push(
          <button key="dispute" type="button" className="small" onClick={() => setMode('dispute')}>
            Open dispute
          </button>,
        );
        break;

      case 'DELIVERED':
        if (isPayer) {
          actions.push(
            <button
              key="complete"
              type="button"
              className="small primary"
              onClick={() => void run(() => api(`/api/orders/${order.id}/complete`, { method: 'POST' }))}
            >
              Complete order
            </button>,
          );
        }
        actions.push(
          <button key="dispute" type="button" className="small" onClick={() => setMode('dispute')}>
            Open dispute
          </button>,
        );
        break;

      case 'COMPLETED':
        if (isPayer) {
          actions.push(
            <button
              key="release"
              type="button"
              className="small primary"
              onClick={() => void run(() => api(`/api/payments/release/${order.id}`, { method: 'POST' }))}
            >
              Release payment
            </button>,
          );
        }
        actions.push(
          <button key="dispute" type="button" className="small" onClick={() => setMode('dispute')}>
            Open dispute
          </button>,
        );
        break;

      default:
        break;
    }
  }

  return (
    <article className={`order${busy ? ' busy' : ''}`}>
      <div className="order-head">
        <div>
          <span className={`state state-${order.state.toLowerCase()}`}>{order.state}</span>
          <div className="order-id">#{order.id.slice(0, 8)}</div>
        </div>
        <div className="amount">
          {money((order.priceCents ?? 0) + (order.calloutFeeCents ?? 0))}
        </div>
      </div>

      <div className="order-meta">
        <div className="meta-item">
          <span className="meta-label">Payer</span>
          <span className="meta-value">{displayNameFor(order.payerId, sessions)}</span>
        </div>
        <div className="meta-item">
          <span className="meta-label">Payee</span>
          <span className="meta-value">{displayNameFor(order.payeeId, sessions)}</span>
        </div>
        <div className="meta-item">
          <span className="meta-label">Terms</span>
          <span className="meta-value terms-line">
            {order.termsVersion
              ? `v${order.termsVersion} · ${order.deliveryMode || '—'} · callout ${money(
                  order.calloutFeeCents ?? 0,
                )}`
              : 'No terms set'}
          </span>
        </div>
      </div>

      {actions.length > 0 && <div className="actions">{actions}</div>}

      {mode === 'terms' && (
        <TermsForm
          order={order}
          detail={detail}
          onClose={() => setMode(null)}
          onSubmit={(body) =>
            run(async () => {
              await api(`/api/orders/${order.id}/terms`, { method: 'PUT', body });
              setMode(null);
            })
          }
          showFlash={showFlash}
        />
      )}

      {mode === 'dispute' && (
        <DisputeForm
          onClose={() => setMode(null)}
          onSubmit={(body) =>
            run(async () => {
              await api(`/api/disputes/${order.id}`, { method: 'POST', body });
              setMode(null);
            })
          }
          showFlash={showFlash}
        />
      )}

      <details className="raw">
        <summary>Raw order</summary>
        <pre>{JSON.stringify(order, null, 2)}</pre>
      </details>
    </article>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label>
      {label}
      {children}
    </label>
  );
}

function TermsForm({
  order,
  detail,
  onClose,
  onSubmit,
  showFlash,
}: {
  order: Order;
  detail: OrderDetail | null;
  onClose: () => void;
  onSubmit: (body: Record<string, unknown>) => Promise<void>;
  showFlash: FlashApi['showFlash'];
}) {
  const latest: TermsVersion | null =
    detail && Array.isArray(detail.terms) && detail.terms.length > 0
      ? detail.terms[detail.terms.length - 1]
      : null;

  const [price, setPrice] = useState(
    order.priceCents != null ? (order.priceCents / 100).toFixed(2) : '',
  );
  const [callout, setCallout] = useState(
    order.calloutFeeCents != null ? (order.calloutFeeCents / 100).toFixed(2) : '',
  );
  const [delivery, setDelivery] = useState(order.deliveryMode ?? 'digital');
  const [scope, setScope] = useState('');
  const [extra, setExtra] = useState('');

  // Prefill the latest version once the detail request lands.
  useEffect(() => {
    if (!latest) return;
    setScope(latest.scopeDescription ?? '');
    setExtra(latest.extraTerms ?? '');
    if (latest.deliveryMode) setDelivery(latest.deliveryMode);
  }, [latest]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!scope.trim()) {
      showFlash('Scope description is required', 'error');
      return;
    }
    await onSubmit({
      priceCents: Math.round(Number(price) * 100),
      calloutFeeCents: Math.max(0, Math.round(Number(callout || 0) * 100)),
      scopeDescription: scope.trim(),
      deliveryMode: delivery,
      extraTerms: extra.trim() || undefined,
    });
  }

  return (
    <div className="inline-form">
      <form onSubmit={handleSubmit}>
        <div className="row">
          <Field label="Price (KES)">
            <input
              type="number"
              min="0.01"
              step="0.01"
              placeholder="1000.00"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              required
            />
          </Field>
          <Field label="Call-out fee (KES)">
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={callout}
              onChange={(e) => setCallout(e.target.value)}
            />
          </Field>
        </div>
        <Field label="Delivery mode">
          <select value={delivery} onChange={(e) => setDelivery(e.target.value)}>
            <option value="digital">Digital delivery</option>
            <option value="in_person">In person</option>
          </select>
        </Field>
        <Field label="Scope">
          <textarea
            placeholder="What is being delivered?"
            value={scope}
            onChange={(e) => setScope(e.target.value)}
            required
          />
        </Field>
        <Field label="Extra terms">
          <textarea
            placeholder="Optional extra terms"
            value={extra}
            onChange={(e) => setExtra(e.target.value)}
          />
        </Field>
        <div className="form-actions">
          <button type="button" className="small ghost" onClick={onClose}>
            Close
          </button>
          <button type="submit" className="small primary">
            Save terms
          </button>
        </div>
      </form>
    </div>
  );
}

const DISPUTE_REASONS = ['NOT_DELIVERED', 'QUALITY', 'NO_RESPONSE', 'OTHER'];

function DisputeForm({
  onClose,
  onSubmit,
  showFlash,
}: {
  onClose: () => void;
  onSubmit: (body: { reason: string; description: string }) => Promise<void>;
  showFlash: FlashApi['showFlash'];
}) {
  const [reason, setReason] = useState(DISPUTE_REASONS[0]);
  const [description, setDescription] = useState('');

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!description.trim()) {
      showFlash('Description is required', 'error');
      return;
    }
    await onSubmit({ reason, description: description.trim() });
  }

  return (
    <div className="inline-form">
      <form onSubmit={handleSubmit}>
        <Field label="Reason">
          <select value={reason} onChange={(e) => setReason(e.target.value)}>
            {DISPUTE_REASONS.map((value) => (
              <option key={value} value={value}>
                {value.replace('_', ' ').toLowerCase()}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Description">
          <textarea
            placeholder="Describe what went wrong"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
          />
        </Field>
        <div className="form-actions">
          <button type="button" className="small ghost" onClick={onClose}>
            Close
          </button>
          <button type="submit" className="small primary">
            Open dispute
          </button>
        </div>
      </form>
    </div>
  );
}

/* ─── Admin / support ───────────────────────────────────────────────────── */

function AdminCard({
  session,
  refreshKey,
  onChanged,
  showFlash,
}: {
  session: Session;
  refreshKey: number;
  onChanged: () => Promise<void>;
} & Pick<FlashApi, 'showFlash'>) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (session.user?.role === 'admin') {
        try {
          setStats(await api<DashboardStats>('/api/admin/dashboard', { quiet: true }));
        } catch {
          /* dashboard is admin-only */
        }
      } else {
        setStats(null);
      }
      const result = await api<{ items: Dispute[] }>('/api/disputes?limit=20', { quiet: true });
      setDisputes(Array.isArray(result?.items) ? result.items : []);
    } catch (err) {
      showFlash((err as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  }, [session.user?.role, showFlash]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  async function resolve(dispute: Dispute, resolution: string) {
    try {
      await api(`/api/disputes/${dispute.id}/resolve`, {
        method: 'POST',
        body: { resolution, notes: 'Resolved from test console' },
      });
      showFlash('Dispute resolved', 'ok');
      await onChanged();
    } catch (err) {
      showFlash((err as Error).message, 'error');
    }
  }

  return (
    <section className="card">
      <h2>Admin &amp; support</h2>
      <div className="stats">
        {stats &&
          (
            [
              ['Users', stats.users],
              ['Orders', stats.orders],
              ['Disputes', stats.disputes],
              ['Revenue', money(stats.revenue)],
            ] as const
          ).map(([label, value]) => (
            <div className="stat" key={label}>
              <b>{String(value ?? '—')}</b>
              <span>{label}</span>
            </div>
          ))}
      </div>
      <button className="small" type="button" onClick={() => void load()} disabled={loading}>
        Refresh disputes &amp; stats
      </button>
      <ul className="disputes mt">
        {disputes.length === 0 && <li className="empty">No disputes.</li>}
        {disputes.map((dispute) => (
          <DisputeItem key={dispute.id} dispute={dispute} onResolve={resolve} />
        ))}
      </ul>
    </section>
  );
}

function DisputeItem({
  dispute,
  onResolve,
}: {
  dispute: Dispute;
  onResolve: (dispute: Dispute, resolution: string) => Promise<void>;
}) {
  const [resolution, setResolution] = useState('REFUND_PAYER');
  const [resolving, setResolving] = useState(false);
  const open = dispute.status === 'OPEN' || dispute.status === 'IN_REVIEW';

  async function handleResolve() {
    setResolving(true);
    try {
      await onResolve(dispute, resolution);
    } finally {
      setResolving(false);
    }
  }

  return (
    <li className="dispute">
      <div className="dispute-title">
        #{String(dispute.orderId).slice(0, 8)} · {dispute.reason} · {dispute.status}
      </div>
      <div className="dispute-meta">{dispute.description}</div>
      {open && (
        <div className="dispute-controls">
          <select value={resolution} onChange={(e) => setResolution(e.target.value)}>
            <option value="REFUND_PAYER">Refund payer</option>
            <option value="RELEASE_PAYEE">Release to payee</option>
            <option value="SPLIT">Split (mark resolved only)</option>
          </select>
          <button
            type="button"
            className="small primary"
            disabled={resolving}
            onClick={() => void handleResolve()}
          >
            Resolve
          </button>
        </div>
      )}
    </li>
  );
}

/* ─── Activity log ──────────────────────────────────────────────────────── */

function ActivityLog({ logs }: { logs: ReturnType<typeof useLogs> }) {
  return (
    <section className="log-wrap">
      <div className="log-panel">
        <div className="content-head">
          <h2>Activity</h2>
          <button className="small ghost" type="button" onClick={clearLogs}>
            Clear
          </button>
        </div>
        <ol className="log">
          {logs.map((entry) => (
            <li key={entry.id} className={`log-item ${entry.kind}`}>
              <time>{entry.time}</time>
              <span>{entry.message}</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
