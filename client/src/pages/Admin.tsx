import { useCallback, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import {
  Activity,
  BookOpenCheck,
  Landmark,
  ShieldAlert,
  Users,
} from 'lucide-react';
import { api } from '../api';
import {
  Card,
  DataTable,
  EmptyState,
  ErrorBanner,
  PageHeader,
  Skeleton,
  StatCard,
  TableMessage,
} from '../components/ui';
import { formatDateTime, money, shortId } from '../format';
import { useEscrows } from '../lib/escrows';
import { humanise } from '../lib/status';
import type { AuditEntry, DashboardStats, LedgerEntry, Paged, User } from '../types';
import { StaffDisputeQueue } from './Disputes';

type Tab = 'overview' | 'disputes' | 'ledger' | 'audit' | 'users';

export function Admin() {
  const { user } = useEscrows();
  const [tab, setTab] = useState<Tab>('overview');

  if (!user) return null;
  if (user.role !== 'admin' && user.role !== 'support') {
    return <Navigate to="/" replace />;
  }

  const tabs: { id: Tab; label: string; adminOnly?: boolean }[] = [
    { id: 'overview', label: 'Overview', adminOnly: true },
    { id: 'disputes', label: 'Disputes' },
    { id: 'ledger', label: 'Ledger', adminOnly: true },
    { id: 'audit', label: 'Audit log', adminOnly: true },
    { id: 'users', label: 'Users', adminOnly: true },
  ];

  const visibleTabs = tabs.filter((item) => !item.adminOnly || user.role === 'admin');
  const activeTab = visibleTabs.some((item) => item.id === tab) ? tab : 'disputes';

  return (
    <>
      <PageHeader
        eyebrow={`${humanise(user.role)} workspace`}
        title="Administration"
        description="Operational visibility across users, escrows, payments and disputes."
      />

      <div className="tabs admin-tabs" role="tablist" aria-label="Admin sections">
        {visibleTabs.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={activeTab === item.id}
            className={`tab${activeTab === item.id ? ' active' : ''}`}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && <Overview />}
      {activeTab === 'disputes' && <StaffDisputeQueue />}
      {activeTab === 'ledger' && <Ledger />}
      {activeTab === 'audit' && <AuditLog />}
      {activeTab === 'users' && <UsersPanel />}
    </>
  );
}

function useAdminData<T>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await api<T>(path, { quiet: true }));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    void load();
  }, [load]);

  return { data, loading, error, reload: load };
}

function Overview() {
  const { data, loading, error, reload } = useAdminData<DashboardStats>('/api/admin/dashboard');

  if (loading) return <Card><Skeleton lines={6} /></Card>;
  if (error) return <ErrorBanner message={error} onRetry={() => void reload()} />;

  return (
    <>
      <div className="stats-grid">
        <StatCard label="Total users" value={data?.users ?? 0} icon={<Users size={18} />} />
        <StatCard label="Total escrows" value={data?.orders ?? 0} icon={<Activity size={18} />} />
        <StatCard
          label="Open disputes"
          value={data?.disputes ?? 0}
          icon={<ShieldAlert size={18} />}
          tone={(data?.disputes ?? 0) > 0 ? 'amber' : 'default'}
        />
        <StatCard
          label="Platform revenue"
          value={money(data?.revenue ?? 0)}
          hint="Recorded platform fees"
          icon={<Landmark size={18} />}
          tone="emerald"
        />
      </div>

      <Card title="Operational coverage">
        <ul className="coverage-list">
          <li>
            <strong>Available</strong>
            <span>Users, escrows, disputes, ledger entries and audit history.</span>
          </li>
          <li>
            <strong>Not exposed by this API</strong>
            <span>
              M-Pesa payment monitoring, webhook events and timer/deadline monitoring have no
              read endpoints yet, so they are not shown rather than approximated.
            </span>
          </li>
          <li>
            <strong>Accounting integrity</strong>
            <span>
              There are no balance-editing controls. All financial movement is performed by
              authorised backend operations and recorded in the ledger.
            </span>
          </li>
        </ul>
      </Card>
    </>
  );
}

function Ledger() {
  const { data, loading, error, reload } = useAdminData<Paged<LedgerEntry>>('/api/admin/ledger?limit=50');
  const items = data?.items ?? [];

  return (
    <Card title="Ledger entries" action={<button type="button" className="btn btn-secondary btn-sm" onClick={() => void reload()}>Refresh</button>}>
      {error && <ErrorBanner message={error} onRetry={() => void reload()} />}
      {loading ? (
        <Skeleton lines={8} />
      ) : items.length === 0 ? (
        <EmptyState icon={<BookOpenCheck size={22} />} title="No ledger entries" description="Entries appear when escrows are funded, released or refunded." />
      ) : (
        <DataTable head={['Transaction', 'From', 'To', 'Amount', 'Reason', 'Reference', 'Date']}>
          {items.map((entry) => (
            <tr key={entry.id}>
              <td className="mono">{shortId(entry.transactionId)}</td>
              <td>{entry.fromAccount}</td>
              <td>{entry.toAccount}</td>
              <td className="num">{money(entry.amountCents)}</td>
              <td>{humanise(entry.reason)}</td>
              <td className="mono">{entry.refId ?? shortId(entry.orderId)}</td>
              <td>{formatDateTime(entry.createdAt)}</td>
            </tr>
          ))}
        </DataTable>
      )}
    </Card>
  );
}

function AuditLog() {
  const { data, loading, error, reload } = useAdminData<Paged<AuditEntry>>('/api/admin/audit-log?limit=50');
  const items = data?.items ?? [];

  return (
    <Card title="Audit log" action={<button type="button" className="btn btn-secondary btn-sm" onClick={() => void reload()}>Refresh</button>}>
      {error && <ErrorBanner message={error} onRetry={() => void reload()} />}
      {loading ? (
        <Skeleton lines={8} />
      ) : (
        <DataTable head={['Table', 'Action', 'Record', 'Actor', 'Date']}>
          {items.length === 0 ? (
            <TableMessage>No audit entries returned.</TableMessage>
          ) : (
            items.map((entry) => (
              <tr key={entry.id}>
                <td>{entry.tableName}</td>
                <td>{humanise(entry.action)}</td>
                <td className="mono">{shortId(entry.recordId)}</td>
                <td className="mono">{shortId(entry.actorId)}</td>
                <td>{formatDateTime(entry.createdAt)}</td>
              </tr>
            ))
          )}
        </DataTable>
      )}
    </Card>
  );
}

function UsersPanel() {
  const { data, loading, error, reload } = useAdminData<Paged<User>>('/api/users?limit=50');
  const items = data?.items ?? [];

  return (
    <Card title="Users" action={<button type="button" className="btn btn-secondary btn-sm" onClick={() => void reload()}>Refresh</button>}>
      {error && <ErrorBanner message={error} onRetry={() => void reload()} />}
      {loading ? (
        <Skeleton lines={8} />
      ) : items.length === 0 ? (
        <EmptyState icon={<Users size={22} />} title="No users returned" description="User records will appear here." />
      ) : (
        <DataTable head={['Name', 'Phone', 'Role', 'KYC tier', 'Joined']}>
          {items.map((item) => (
            <tr key={item.id}>
              <td>{item.displayName}</td>
              <td>{item.phone}</td>
              <td><span className="badge tone-neutral">{humanise(item.role)}</span></td>
              <td>Tier {item.kycTier}</td>
              <td>{formatDateTime(item.createdAt)}</td>
            </tr>
          ))}
        </DataTable>
      )}
    </Card>
  );
}
