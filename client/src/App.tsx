import { useEffect, useState } from 'react';
import {
  Bell,
  CircleHelp,
  FilePlus2,
  Handshake,
  LayoutDashboard,
  LogOut,
  Menu,
  ReceiptText,
  ShieldCheck,
  ShieldHalf,
  TriangleAlert,
  UserRound,
  Wallet as WalletIcon,
  X,
} from 'lucide-react';
import { NavLink, Navigate, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { signOut } from './api';
import { EscrowProvider, useEscrows } from './lib/escrows';
import { needsAction } from './lib/status';
import { activeSession, useAppState } from './store';
import { Dashboard } from './pages/Dashboard';
import { Escrows } from './pages/Escrows';
import { EscrowDetail } from './pages/EscrowDetail';
import { CreateEscrow } from './pages/CreateEscrow';
import { Wallet } from './pages/Wallet';
import { Transactions } from './pages/Transactions';
import { Disputes } from './pages/Disputes';
import { Notifications } from './pages/Notifications';
import { Profile } from './pages/Profile';
import { Admin } from './pages/Admin';
import { Help } from './pages/Help';
import { Login } from './pages/Login';
import { NotFound } from './pages/NotFound';

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<ProtectedShell />}>
        <Route index element={<Dashboard />} />
        <Route path="escrows" element={<Escrows />} />
        <Route path="escrows/new" element={<CreateEscrow />} />
        <Route path="escrows/:id" element={<EscrowDetail />} />
        <Route path="wallet" element={<Wallet />} />
        <Route path="transactions" element={<Transactions />} />
        <Route path="disputes" element={<Disputes />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="profile" element={<Profile />} />
        <Route path="admin" element={<Admin />} />
        <Route path="help" element={<Help />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}

/* ─── Authenticated shell ───────────────────────────────────────────────── */

function ProtectedShell() {
  const { sessions, activePhone } = useAppState();
  const session = activeSession(sessions, activePhone);
  const location = useLocation();

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return (
    <EscrowProvider>
      <Shell />
    </EscrowProvider>
  );
}

function Shell() {
  const { sessions, activePhone } = useAppState();
  const session = activeSession(sessions, activePhone);
  const { user, orders, refresh } = useEscrows();
  const navigate = useNavigate();
  const location = useLocation();
  const [navOpen, setNavOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const currentUser = user ?? session?.user ?? null;
  const isStaff = currentUser?.role === 'admin' || currentUser?.role === 'support';

  const pendingCount = currentUser
    ? orders.filter((order) => needsAction(order, currentUser.id)).length
    : 0;

  useEffect(() => {
    setNavOpen(false);
    setProfileOpen(false);
  }, [location.pathname]);

  async function handleSignOut() {
    if (!session) return;
    setSigningOut(true);
    try {
      await signOut(session);
      navigate('/login', { replace: true });
    } finally {
      setSigningOut(false);
    }
  }

  const navSections = [
    {
      title: 'Workspace',
      items: [
        { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
        { to: '/escrows', label: 'My Escrows', icon: Handshake },
        { to: '/escrows/new', label: 'Create Escrow', icon: FilePlus2 },
        { to: '/wallet', label: 'Wallet', icon: WalletIcon },
        { to: '/transactions', label: 'Transactions', icon: ReceiptText },
        { to: '/disputes', label: 'Disputes', icon: TriangleAlert },
        { to: '/notifications', label: 'Notifications', icon: Bell, badge: pendingCount },
      ],
    },
    {
      title: 'Account',
      items: [
        { to: '/profile', label: 'Profile & Verification', icon: UserRound },
        { to: '/help', label: 'Help & Support', icon: CircleHelp },
      ],
    },
  ];

  if (isStaff) {
    navSections.push({
      title: 'Administration',
      items: [{ to: '/admin', label: 'Admin workspace', icon: ShieldHalf }],
    });
  }

  return (
    <div className="app-shell">
      {navOpen && (
        <button
          type="button"
          className="nav-scrim"
          aria-label="Close navigation"
          onClick={() => setNavOpen(false)}
        />
      )}

      <aside className={`sidebar${navOpen ? ' nav-open' : ''}`}>
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            <ShieldCheck size={20} />
          </span>
          <div>
            <span className="brand-name">Escrow</span>
            <span className="brand-sub">Secure trade · Kenya</span>
          </div>
          <button
            type="button"
            className="icon-btn sidebar-close"
            onClick={() => setNavOpen(false)}
            aria-label="Close navigation"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="nav" aria-label="Main navigation">
          {navSections.map((section) => (
            <div className="nav-section" key={section.title}>
              <p className="nav-title">{section.title}</p>
              {section.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={'end' in item ? item.end : undefined}
                  className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
                >
                  <item.icon size={18} aria-hidden="true" />
                  <span>{item.label}</span>
                  {'badge' in item && item.badge ? (
                    <span className="nav-badge">{item.badge}</span>
                  ) : null}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <p className="security-note">
            <ShieldCheck size={14} aria-hidden="true" /> Funds held in a protected ledger account.
          </p>
          <p className="version">Escrow platform · v0.1</p>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <button
            type="button"
            className="icon-btn menu-btn"
            onClick={() => setNavOpen(true)}
            aria-label="Open navigation"
          >
            <Menu size={20} />
          </button>

          <div className="topbar-title">
            <span className="topbar-crumb">Workspace</span>
          </div>

          <div className="topbar-actions">
            <button
              type="button"
              className="icon-btn bell-btn"
              onClick={() => void refresh()}
              aria-label="Refresh data"
              title="Refresh data"
            >
              <Bell size={18} />
              {pendingCount > 0 && <span className="bell-dot">{pendingCount}</span>}
            </button>

            <div className="profile-menu">
              <button
                type="button"
                className="profile-trigger"
                onClick={() => setProfileOpen((open) => !open)}
                aria-haspopup="menu"
                aria-expanded={profileOpen}
              >
                <span className="avatar" aria-hidden="true">
                  {(currentUser?.displayName ?? 'U').slice(0, 1).toUpperCase()}
                </span>
                <span className="profile-meta">
                  <span className="profile-name">{currentUser?.displayName ?? 'Account'}</span>
                  <span className="profile-role">{currentUser?.role ?? 'user'}</span>
                </span>
              </button>

              {profileOpen && (
                <div className="dropdown" role="menu">
                  <NavLink to="/profile" role="menuitem">
                    <UserRound size={15} /> Profile & verification
                  </NavLink>
                  <NavLink to="/notifications" role="menuitem">
                    <Bell size={15} /> Notifications
                  </NavLink>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => void handleSignOut()}
                    disabled={signingOut}
                  >
                    <LogOut size={15} /> {signingOut ? 'Signing out…' : 'Sign out'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="page">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
