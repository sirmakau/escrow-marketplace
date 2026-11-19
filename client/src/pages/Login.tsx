import { useState } from 'react';
import type { FormEvent } from 'react';
import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Eye,
  EyeOff,
  Lock,
  ShieldCheck,
  Smartphone,
  UserRound,
} from 'lucide-react';
import { register, signIn } from '../api';
import { useAppState } from '../store';
import { activeSession } from '../store';
import { Spinner } from '../components/ui';

type Mode = 'login' | 'register';

export function Login() {
  const { sessions, activePhone } = useAppState();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const expired = params.get('expired') === '1';

  const [mode, setMode] = useState<Mode>('login');
  const [phone, setPhone] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (activeSession(sessions, activePhone)) {
    return <Navigate to="/" replace />;
  }

  const from = (location.state as { from?: string } | null)?.from ?? '/';

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === 'login') {
        await signIn(phone, password);
      } else {
        await register({ phone, password, displayName });
      }
      navigate(from, { replace: true });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setPassword('');
  }

  return (
    <div className="auth-page">
      <section className="auth-brand">
        <div className="brand brand-on-dark">
          <span className="brand-mark" aria-hidden="true">
            <ShieldCheck size={20} />
          </span>
          <div>
            <span className="brand-name">Escrow</span>
            <span className="brand-sub">Secure trade · Kenya</span>
          </div>
        </div>

        <div className="auth-pitch">
          <h1>Trade with confidence. Your money moves only when both sides agree.</h1>
          <p>
            Escrow holds the buyer&apos;s payment securely until the agreed conditions are
            fulfilled — so buyers get what they paid for and sellers get paid.
          </p>
          <ul className="auth-points">
            <li>
              <ShieldCheck size={18} aria-hidden="true" />
              <div>
                <strong>Protected funds</strong>
                <span>Money is held in a dedicated ledger account, not with either party.</span>
              </div>
            </li>
            <li>
              <Smartphone size={18} aria-hidden="true" />
              <div>
                <strong>M-Pesa payments</strong>
                <span>Fund and release with the payment method Kenya trusts.</span>
              </div>
            </li>
            <li>
              <Lock size={18} aria-hidden="true" />
              <div>
                <strong>Transparent records</strong>
                <span>Every step, acceptance and payment is recorded and auditable.</span>
              </div>
            </li>
          </ul>
        </div>

        <p className="auth-legal">
          By continuing you agree to the platform terms and the escrow conditions shown for each
          agreement.
        </p>
      </section>

      <section className="auth-panel">
        <div className="auth-card">
          <div className="auth-tabs" role="tablist" aria-label="Authentication">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'login'}
              className={mode === 'login' ? 'active' : ''}
              onClick={() => switchMode('login')}
            >
              Sign in
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'register'}
              className={mode === 'register' ? 'active' : ''}
              onClick={() => switchMode('register')}
            >
              Create account
            </button>
          </div>

          <div className="auth-heading">
            <h2>{mode === 'login' ? 'Welcome back' : 'Open your escrow account'}</h2>
            <p>
              {mode === 'login'
                ? 'Sign in to manage your escrows, wallet and payouts.'
                : 'Create your account, then complete verification to start trading.'}
            </p>
          </div>

          {expired && mode === 'login' && (
            <div className="alert alert-warning" role="status">
              <div>
                <strong>Your session expired</strong>
                <p>Sign in again to continue. Your escrows are unchanged.</p>
              </div>
            </div>
          )}

          {error && (
            <div className="alert alert-error" role="alert">
              <div>
                <strong>We couldn&apos;t continue</strong>
                <p>{error}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="auth-form">
            {mode === 'register' && (
              <label className="field">
                <span className="field-label">Display name</span>
                <span className="input-with-icon">
                  <UserRound size={16} aria-hidden="true" />
                  <input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="How your counterparty will see you"
                    autoComplete="name"
                    minLength={2}
                    maxLength={100}
                    required
                  />
                </span>
              </label>
            )}

            <label className="field">
              <span className="field-label">Phone number</span>
              <span className="input-with-icon">
                <Smartphone size={16} aria-hidden="true" />
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+254 712 345 678"
                  inputMode="tel"
                  autoComplete="tel"
                  required
                />
              </span>
              <span className="field-hint">Use the M-Pesa number registered to you.</span>
            </label>

            <label className="field">
              <span className="field-label">Password</span>
              <span className="input-with-icon input-with-action">
                <Lock size={16} aria-hidden="true" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === 'register' ? 'At least 8 characters' : 'Your password'}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  minLength={8}
                  required
                />
                <button
                  type="button"
                  className="input-action"
                  onClick={() => setShowPassword((show) => !show)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </span>
            </label>

            {mode === 'register' && (
              <p className="form-note">
                New accounts start at verification tier 0. You can fund or accept escrows, and
                creating escrows unlocks after verification.
              </p>
            )}

            <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
              {busy ? <Spinner label={mode === 'login' ? 'Signing in…' : 'Creating account…'} /> : mode === 'login' ? 'Sign in' : 'Create account'}
            </button>
          </form>

          <p className="auth-switch">
            {mode === 'login' ? (
              <>
                New to Escrow?{' '}
                <button type="button" onClick={() => switchMode('register')}>
                  Create an account
                </button>
              </>
            ) : (
              <>
                Already registered?{' '}
                <button type="button" onClick={() => switchMode('login')}>
                  Sign in
                </button>
              </>
            )}
          </p>
        </div>

        <p className="auth-support">
          Need help signing in? <a href="/help">Visit support</a>
        </p>
      </section>
    </div>
  );
}
