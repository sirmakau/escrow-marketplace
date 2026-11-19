import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BadgeCheck, CheckCircle, Copy, Lock, LogOut, ShieldCheck, Smartphone, UserRound } from 'lucide-react';
import { signOut } from '../api';
import { Card, ErrorBanner, PageHeader, Skeleton } from '../components/ui';
import { formatDate } from '../format';
import { useEscrows } from '../lib/escrows';
import { activeSession, useAppState } from '../store';

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // No-op on clipboard failure.
    }
  }

  return (
    <button
      type="button"
      className="copy-btn"
      onClick={handleCopy}
      aria-label="Copy account ID"
      title="Copy account ID"
    >
      {copied ? <CheckCircle size={14} /> : <Copy size={14} />}
      <span>{copied ? 'Copied' : 'Copy'}</span>
    </button>
  );
}

const TIERS = [
  {
    tier: 0,
    title: 'Registered',
    description: 'Sign in, accept terms, fund escrows and receive payouts.',
  },
  {
    tier: 1,
    title: 'Verified trader',
    description: 'Create escrow agreements and act as a seller.',
  },
  {
    tier: 2,
    title: 'Enhanced verification',
    description: 'Higher-value agreements and platform operations access.',
  },
];

export function Profile() {
  const { user, loading, error, refresh } = useEscrows();
  const { sessions, activePhone } = useAppState();
  const session = activeSession(sessions, activePhone);
  const navigate = useNavigate();

  async function handleSignOut() {
    if (!session) return;
    await signOut(session);
    navigate('/login', { replace: true });
  }

  const currentTier = user?.kycTier ?? 0;

  return (
    <>
      <PageHeader
        title="Profile & Verification"
        description="Your account details and what you're allowed to do on the platform."
      />

      {error && <ErrorBanner message={error} onRetry={() => void refresh()} />}

      <div className="dashboard-grid">
        <Card title="Account" className="span-2">
          {loading && !user ? (
            <Skeleton lines={5} />
          ) : (
            <div className="profile-grid">
              <div className="profile-identity">
                <span className="avatar avatar-lg" aria-hidden="true">
                  {(user?.displayName ?? 'U').slice(0, 1).toUpperCase()}
                </span>
                <div>
                  <h3>{user?.displayName ?? '—'}</h3>
                  <span className="role-tag">{user?.role ?? 'user'}</span>
                </div>
              </div>

              <dl className="detail-list">
                <div>
                  <dt>
                    <Smartphone size={14} /> Phone number
                  </dt>
                  <dd>{user?.phone ?? '—'}</dd>
                </div>
                <div>
                  <dt>
                    <UserRound size={14} /> Display name
                  </dt>
                  <dd>{user?.displayName ?? '—'}</dd>
                </div>
                <div>
                  <dt>
                    <BadgeCheck size={14} /> Verification tier
                  </dt>
                  <dd>Tier {currentTier}</dd>
                </div>
                <div>
                  <dt>
                    <ShieldCheck size={14} /> Member since
                  </dt>
                  <dd>{formatDate(user?.createdAt)}</dd>
                </div>
                <div>
                  <dt>
                    <UserRound size={14} /> Account ID
                  </dt>
                  <dd>
                    <span className="mono">{user?.id}</span>
                    {user?.id && <CopyButton value={user.id} />}
                  </dd>
                </div>
              </dl>
            </div>
          )}

          <p className="form-note">
            Profile editing is not available in this API version. Contact support to correct your
            legal name or phone number.
          </p>
        </Card>

        <Card title="Security">
          <ul className="security-list">
            <li>
              <Lock size={16} aria-hidden="true" />
              <div>
                <strong>Session security</strong>
                <span>
                  Access tokens are short-lived and refresh tokens rotate on every renewal.
                </span>
              </div>
            </li>
            <li>
              <ShieldCheck size={16} aria-hidden="true" />
              <div>
                <strong>Protected identification</strong>
                <span>
                  KYC identification numbers are never displayed in the interface or exposed to
                  counterparties.
                </span>
              </div>
            </li>
          </ul>

          <button type="button" className="btn btn-secondary btn-block" onClick={() => void handleSignOut()}>
            <LogOut size={16} /> Sign out of this device
          </button>
        </Card>
      </div>

      <Card title="Verification levels">
        <div className="tier-grid">
          {TIERS.map((tier) => {
            const unlocked = currentTier >= tier.tier;
            const current = currentTier === tier.tier;
            return (
              <div key={tier.tier} className={`tier-card${current ? ' current' : ''}`}>
                <div className="tier-head">
                  <span className="tier-number">{tier.tier}</span>
                  <span className={`badge ${unlocked ? 'tone-success' : 'tone-muted'}`}>
                    {current ? 'Current tier' : unlocked ? 'Unlocked' : 'Locked'}
                  </span>
                </div>
                <h3>{tier.title}</h3>
                <p>{tier.description}</p>
              </div>
            );
          })}
        </div>
        <p className="form-note">
          Tier upgrades are reviewed by support. There is no self-service KYC upload endpoint in
          this API version; contact support with your documents.
        </p>
      </Card>
    </>
  );
}
