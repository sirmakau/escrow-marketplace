import type { ReactNode } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { stateMeta } from '../lib/status';

/* ─── Status ────────────────────────────────────────────────────────────── */

export function StatusBadge({ state }: { state: string }) {
  const meta = stateMeta(state);
  return <span className={`badge tone-${meta.tone}`}>{meta.label}</span>;
}

/* ─── Layout ────────────────────────────────────────────────────────────── */

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {description && <p className="page-description">{description}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}

export function Card({
  title,
  action,
  children,
  className = '',
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`card ${className}`}>
      {(title || action) && (
        <div className="card-head">
          {title && <h2>{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = 'default',
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: 'default' | 'emerald' | 'amber' | 'navy';
}) {
  return (
    <div className={`stat-card stat-${tone}`}>
      <div className="stat-top">
        <span className="stat-label">{label}</span>
        {icon && <span className="stat-icon">{icon}</span>}
      </div>
      <div className="stat-value">{value}</div>
      {hint && <div className="stat-hint">{hint}</div>}
    </div>
  );
}

/* ─── States ────────────────────────────────────────────────────────────── */

export function Spinner({ label }: { label?: string }) {
  return (
    <span className="spinner-wrap" role="status">
      <Loader2 className="spin" size={16} aria-hidden="true" />
      {label && <span>{label}</span>}
    </span>
  );
}

export function Skeleton({ lines = 3, className = '' }: { lines?: number; className?: string }) {
  return (
    <div className={`skeleton ${className}`} aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <span key={i} className={`sk-line${i === 0 ? ' sk-title' : ''}`} />
      ))}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      {icon && <span className="empty-icon">{icon}</span>}
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {action && <div className="empty-action">{action}</div>}
    </div>
  );
}

export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="alert alert-error" role="alert">
      <AlertTriangle size={18} aria-hidden="true" />
      <div>
        <strong>Something went wrong</strong>
        <p>{message}</p>
      </div>
      {onRetry && (
        <button type="button" className="btn btn-secondary btn-sm" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}

export function Notice({
  tone = 'info',
  title,
  children,
}: {
  tone?: 'info' | 'warning' | 'success';
  title?: string;
  children: ReactNode;
}) {
  return (
    <div className={`alert alert-${tone}`}>
      <div>
        {title && <strong>{title}</strong>}
        <p>{children}</p>
      </div>
    </div>
  );
}

/* ─── Overlays ──────────────────────────────────────────────────────────── */

export function Modal({
  open,
  title,
  description,
  onClose,
  children,
  footer,
}: {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children?: ReactNode;
  footer?: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <div>
            <h2>{title}</h2>
            {description && <p>{description}</p>}
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        {children && <div className="modal-body">{children}</div>}
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  tone = 'primary',
  busy,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  tone?: 'primary' | 'danger';
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal
      open={open}
      title={title}
      description={description}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className={`btn ${tone === 'danger' ? 'btn-danger' : 'btn-primary'}`}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? <Spinner label={confirmLabel} /> : confirmLabel}
          </button>
        </>
      }
    />
  );
}

/* ─── Forms & tables ────────────────────────────────────────────────────── */

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
      {error && <span className="field-error">{error}</span>}
    </label>
  );
}

export function DataTable({
  head,
  children,
  empty,
}: {
  head: string[];
  children: ReactNode;
  empty?: ReactNode;
}) {
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            {head.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
      {empty}
    </div>
  );
}

export function TableMessage({ children }: { children: ReactNode }) {
  return (
    <tr>
      <td className="table-message" colSpan={8}>
        {children}
      </td>
    </tr>
  );
}

export function Steps({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="steps">
      {steps.map((step, index) => (
        <li
          key={step}
          className={`step${index === current ? ' current' : ''}${index < current ? ' done' : ''}`}
        >
          <span className="step-dot">{index < current ? '✓' : index + 1}</span>
          <span>{step}</span>
        </li>
      ))}
    </ol>
  );
}
