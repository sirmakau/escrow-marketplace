import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FilePlus2, Search, ShieldCheck } from 'lucide-react';
import { EscrowCard } from '../components/EscrowCard';
import { Card, EmptyState, ErrorBanner, PageHeader, Skeleton } from '../components/ui';
import { reference } from '../format';
import { useEscrows } from '../lib/escrows';
import { needsAction, stateMeta } from '../lib/status';

type Tab = 'all' | 'attention' | 'active' | 'disputed' | 'closed';

const TABS: { id: Tab; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'attention', label: 'Needs action' },
  { id: 'active', label: 'Active' },
  { id: 'disputed', label: 'Disputed' },
  { id: 'closed', label: 'Closed' },
];

const PAGE_SIZE = 9;

export function Escrows() {
  const { orders, user, loading, error, refresh } = useEscrows();
  const [tab, setTab] = useState<Tab>('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<'newest' | 'oldest' | 'amount'>('newest');
  const [page, setPage] = useState(1);

  const counts = useMemo(() => {
    const byTab: Record<Tab, number> = {
      all: orders.length,
      attention: orders.filter((o) => needsAction(o, user?.id)).length,
      active: orders.filter((o) => stateMeta(o.state).group === 'active').length,
      disputed: orders.filter((o) => stateMeta(o.state).group === 'disputed').length,
      closed: orders.filter((o) => stateMeta(o.state).group === 'closed').length,
    };
    return byTab;
  }, [orders, user?.id]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return orders
      .filter((order) => {
        if (tab === 'attention' && !needsAction(order, user?.id)) return false;
        if (tab === 'active' && stateMeta(order.state).group !== 'active') return false;
        if (tab === 'disputed' && stateMeta(order.state).group !== 'disputed') return false;
        if (tab === 'closed' && stateMeta(order.state).group !== 'closed') return false;
        if (!query) return true;
        return (
          order.id.toLowerCase().includes(query) ||
          reference(order.id).toLowerCase().includes(query) ||
          order.state.toLowerCase().includes(query)
        );
      })
      .sort((a, b) => {
        if (sort === 'amount') {
          return (
            (b.priceCents ?? 0) + (b.calloutFeeCents ?? 0) -
            ((a.priceCents ?? 0) + (a.calloutFeeCents ?? 0))
          );
        }
        const diff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        return sort === 'oldest' ? diff : -diff;
      });
  }, [orders, tab, search, sort, user?.id]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pages);
  const visible = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function changeTab(next: Tab) {
    setTab(next);
    setPage(1);
  }

  return (
    <>
      <PageHeader
        eyebrow={`${orders.length} escrow${orders.length === 1 ? '' : 's'} on this account`}
        title="My Escrows"
        description="Every agreement, its current status and what happens next."
        actions={
          <Link to="/escrows/new" className="btn btn-primary">
            <FilePlus2 size={16} /> Create escrow
          </Link>
        }
      />

      {error && <ErrorBanner message={error} onRetry={() => void refresh()} />}

      <Card className="filter-card">
        <div className="filter-row">
          <div className="search-box">
            <Search size={16} aria-hidden="true" />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search by escrow reference or status"
              aria-label="Search escrows"
            />
          </div>
          <label className="inline-field">
            <span>Sort</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as typeof sort)}
              aria-label="Sort escrows"
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="amount">Highest amount</option>
            </select>
          </label>
        </div>

        <div className="tabs" role="tablist" aria-label="Escrow status">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              className={`tab${tab === item.id ? ' active' : ''}`}
              onClick={() => changeTab(item.id)}
            >
              {item.label}
              <span className="tab-count">{counts[item.id]}</span>
            </button>
          ))}
        </div>
      </Card>

      {loading && orders.length === 0 ? (
        <div className="escrow-list">
          {Array.from({ length: 3 }).map((_, i) => (
            <div className="escrow-card" key={i}>
              <Skeleton lines={5} />
            </div>
          ))}
        </div>
      ) : visible.length === 0 ? (
        <Card>
          <EmptyState
            icon={<ShieldCheck size={24} />}
            title={orders.length === 0 ? 'No escrows yet' : 'No escrows match this view'}
            description={
              orders.length === 0
                ? 'Create your first escrow agreement to protect a transaction.'
                : 'Try another status tab or clear your search.'
            }
            action={
              orders.length === 0 ? (
                <Link to="/escrows/new" className="btn btn-primary">
                  <FilePlus2 size={16} /> Create escrow
                </Link>
              ) : (
                <button type="button" className="btn btn-secondary" onClick={() => { setSearch(''); changeTab('all'); }}>
                  Clear filters
                </button>
              )
            }
          />
        </Card>
      ) : (
        <>
          <div className="escrow-list">
            {visible.map((order) => (
              <EscrowCard key={order.id} order={order} />
            ))}
          </div>

          {pages > 1 && (
            <nav className="pagination" aria-label="Escrow pages">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={safePage <= 1}
                onClick={() => setPage(safePage - 1)}
              >
                Previous
              </button>
              <span>
                Page {safePage} of {pages}
              </span>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={safePage >= pages}
                onClick={() => setPage(safePage + 1)}
              >
                Next
              </button>
            </nav>
          )}
        </>
      )}

      <p className="table-note">
        This view shows the 50 most recent escrows returned by the API. Older records will be
        available through pagination in a future release.
      </p>
    </>
  );
}
