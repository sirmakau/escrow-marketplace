import { Link } from 'react-router-dom';
import { ArrowDownToLine, ArrowUpRight, Info, ShieldCheck, Wallet as WalletIcon } from 'lucide-react';
import { Card, ErrorBanner, PageHeader, Skeleton, StatCard } from '../components/ui';
import { shortId } from '../format';
import { money } from '../format';
import { useEscrows } from '../lib/escrows';

export function Wallet() {
  const { user, loading, error, refresh } = useEscrows();
  const wallet = user?.wallet;

  return (
    <>
      <PageHeader
        title="Wallet"
        description="Balances reported directly by the platform ledger."
        actions={
          <Link to="/escrows/new" className="btn btn-primary">
            Fund an escrow
          </Link>
        }
      />

      {error && <ErrorBanner message={error} onRetry={() => void refresh()} />}

      <div className="stats-grid stats-grid-3">
        {loading && !user ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div className="stat-card" key={i}>
              <Skeleton lines={2} />
            </div>
          ))
        ) : (
          <>
            <StatCard
              label="Available balance"
              value={money(wallet?.balance ?? 0)}
              hint="Available to withdraw or spend"
              icon={<WalletIcon size={18} />}
              tone="emerald"
            />
            <StatCard
              label="Held in escrow"
              value={money(wallet?.heldBalance ?? 0)}
              hint="Committed to active agreements"
              icon={<ShieldCheck size={18} />}
              tone="navy"
            />
            <StatCard
              label="Wallet reference"
              value={wallet?.id ? shortId(wallet.id) : '—'}
              hint={wallet?.id ? wallet.id : 'No wallet reference returned'}
              icon={<Info size={18} />}
            />
          </>
        )}
      </div>

      <div className="dashboard-grid">
        <Card title="Balance explained" className="span-2">
          <div className="explain-grid">
            <div>
              <h3>Available</h3>
              <p>
                Funds you can withdraw or use. The figure comes from the wallet row maintained by
                the ledger — it is never calculated in the browser.
              </p>
            </div>
            <div>
              <h3>Held</h3>
              <p>
                Money currently committed to escrows. It moves to the seller only when the buyer
                releases it, or back to the buyer if a dispute is refunded.
              </p>
            </div>
          </div>
          <div className="alert alert-info">
            <Info size={18} aria-hidden="true" />
            <div>
              <strong>Ledger is the source of truth</strong>
              <p>
                Wallet balances cannot be edited from the interface. Every movement is recorded as
                an auditable ledger transaction.
              </p>
            </div>
          </div>
        </Card>

        <Card title="Statement">
          <div className="empty-state">
            <span className="empty-icon">
              <ArrowDownToLine size={22} />
            </span>
            <h3>Statement not available yet</h3>
            <p>
              Deposits, withdrawals and escrow movements are recorded in the ledger, but the
              wallet statement endpoint is not exposed by this API version. Your escrow history is
              available under Transactions.
            </p>
            <div className="empty-action">
              <Link to="/transactions" className="btn btn-secondary">
                View escrow activity <ArrowUpRight size={14} />
              </Link>
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}
