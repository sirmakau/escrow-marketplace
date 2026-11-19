import { Link } from 'react-router-dom';
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  FilePlus2,
  Handshake,
  ShieldCheck,
  Wallet as WalletIcon,
} from 'lucide-react';
import { EscrowCard } from '../components/EscrowCard';
import {
  Card,
  EmptyState,
  ErrorBanner,
  PageHeader,
  Skeleton,
  StatCard,
  StatusBadge,
} from '../components/ui';
import { formatDate, isDueSoon, isOverdue, money, reference, timeAgo } from '../format';
import { useEscrows } from '../lib/escrows';
import { needsAction, pendingReason, stateMeta } from '../lib/status';

export function Dashboard() {
  const { orders, user, loading, error, refresh, lastUpdated } = useEscrows();
  const userId = user?.id;

  const active = orders.filter((o) => stateMeta(o.state).group === 'active');
  const completed = orders.filter((o) => ['COMPLETED', 'RELEASED'].includes(o.state));
  const attention = orders
    .filter((o) => needsAction(o, userId))
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  const recent = [...orders]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 5);

  const deadlines = orders
    .flatMap((order) => {
      const entries: { order: typeof order; label: string; at: string }[] = [];
      if (order.state === 'ACCEPTED' && order.fundingDeadline) {
        entries.push({ order, label: 'Funding deadline', at: order.fundingDeadline });
      }
      if (
        order.reviewDeadline &&
        ['DELIVERED', 'COMPLETED'].includes(order.state)
      ) {
        entries.push({ order, label: 'Review deadline', at: order.reviewDeadline });
      }
      return entries;
    })
    .filter((entry) => isDueSoon(entry.at, 72) || isOverdue(entry.at))
    .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
    .slice(0, 5);

  const greeting = (() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  const firstName = (user?.displayName ?? 'there').split(' ')[0];

  if (loading && orders.length === 0) {
    return (
      <>
        <PageHeader title={`${greeting}, ${firstName}`} description="Loading your escrow workspace…" />
        <div className="stats-grid">
          {Array.from({ length: 4 }).map((_, i) => (
            <div className="stat-card" key={i}>
              <Skeleton lines={2} />
            </div>
          ))}
        </div>
        <div className="dashboard-grid">
          <Card className="span-2"><Skeleton lines={5} /></Card>
          <Card><Skeleton lines={5} /></Card>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow={lastUpdated ? `Updated ${timeAgo(lastUpdated)}` : undefined}
        title={`${greeting}, ${firstName}`}
        description="Here is where your money is and what needs your attention."
        actions={
          <Link to="/escrows/new" className="btn btn-primary">
            <FilePlus2 size={16} /> Create escrow
          </Link>
        }
      />

      {error && <ErrorBanner message={error} onRetry={() => void refresh()} />}

      {user && user.kycTier < 1 && (
        <div className="alert alert-warning">
          <ShieldCheck size={18} aria-hidden="true" />
          <div>
            <strong>Verification required to create escrows</strong>
            <p>
              Your account is at tier {user.kycTier}. Complete verification to create escrows,
              while accepting and funding remain available. <Link to="/profile">View verification</Link>.
            </p>
          </div>
        </div>
      )}

      <div className="stats-grid">
        <StatCard
          label="Available balance"
          value={money(user?.wallet?.balance ?? 0)}
          hint="Withdrawable balance from the ledger"
          icon={<WalletIcon size={18} />}
          tone="emerald"
        />
        <StatCard
          label="Held in escrow"
          value={money(user?.wallet?.heldBalance ?? 0)}
          hint="Funds committed to active escrows"
          icon={<ShieldCheck size={18} />}
          tone="navy"
        />
        <StatCard
          label="Active escrows"
          value={active.length}
          hint={`${orders.length} total on this account`}
          icon={<Handshake size={18} />}
        />
        <StatCard
          label="Needs your attention"
          value={attention.length}
          hint={attention.length > 0 ? 'Action required to progress' : 'You are all caught up'}
          icon={<Clock3 size={18} />}
          tone={attention.length > 0 ? 'amber' : 'default'}
        />
      </div>

      <div className="dashboard-grid">
        <Card
          title="Needs your attention"
          className="span-2"
          action={
            <Link to="/escrows" className="text-link">
              All escrows <ArrowRight size={14} />
            </Link>
          }
        >
          {attention.length === 0 ? (
            <EmptyState
              icon={<CheckCircle2 size={22} />}
              title="Nothing waiting on you"
              description="When an escrow needs your acceptance, funding or confirmation, it will appear here."
            />
          ) : (
            <ul className="attention-list">
              {attention.slice(0, 5).map((order) => (
                <li key={order.id}>
                  <Link to={`/escrows/${order.id}`}>
                    <div className="attention-main">
                      <span className="ref">{reference(order.id)}</span>
                      <StatusBadge state={order.state} />
                      <span className="attention-amount">{money((order.priceCents ?? 0) + (order.calloutFeeCents ?? 0))}</span>
                    </div>
                    <p>{pendingReason(order, userId)}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Upcoming deadlines">
          {deadlines.length === 0 ? (
            <EmptyState
              icon={<CalendarClock size={22} />}
              title="No deadlines soon"
              description="Funding and review deadlines within 72 hours appear here."
            />
          ) : (
            <ul className="deadline-list">
              {deadlines.map(({ order, label, at }) => (
                <li key={`${order.id}-${label}`}>
                  <Link to={`/escrows/${order.id}`}>
                    <span className="deadline-label">{label}</span>
                    <span className="deadline-ref">{reference(order.id)}</span>
                    <span className={isOverdue(at) ? 'deadline-overdue' : 'deadline-date'}>
                      {isOverdue(at) ? 'Overdue' : formatDate(at)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="dashboard-grid">
        <Card
          title="Active escrow agreements"
          className="span-2"
          action={
            active.length > 4 ? (
              <Link to="/escrows" className="text-link">
                View all <ArrowRight size={14} />
              </Link>
            ) : undefined
          }
        >
          {active.length === 0 ? (
            <EmptyState
              icon={<Handshake size={22} />}
              title="No active escrows"
              description="Create an escrow agreement to protect your next transaction."
              action={
                <Link to="/escrows/new" className="btn btn-secondary">
                  <FilePlus2 size={16} /> Create escrow
                </Link>
              }
            />
          ) : (
            <div className="escrow-list">
              {active.slice(0, 4).map((order) => (
                <EscrowCard key={order.id} order={order} />
              ))}
            </div>
          )}
        </Card>

        <Card title="Recent activity">
          {recent.length === 0 ? (
            <EmptyState
              icon={<CircleDollarSign size={22} />}
              title="No activity yet"
              description="Escrow updates will show up here."
            />
          ) : (
            <ul className="activity-list">
              {recent.map((order) => (
                <li key={order.id}>
                  <Link to={`/escrows/${order.id}`}>
                    <StatusBadge state={order.state} />
                    <span className="activity-ref">{reference(order.id)}</span>
                    <span className="activity-meta">
                      {money((order.priceCents ?? 0) + (order.calloutFeeCents ?? 0))} ·{' '}
                      {timeAgo(order.updatedAt)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
