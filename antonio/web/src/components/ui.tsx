import type { ReactNode } from "react";
import { ACTION_STATUS_LABELS, MAIL_CATEGORY_LABELS, type ActionStatus, type MailCategory } from "@antonio/shared";
import { STATUS_TONE } from "../lib/format";

export function StatusBadge({ status }: { status: ActionStatus }) {
  return (
    <span className={`badge ${STATUS_TONE[status]}`} data-status={status}>
      <span className="dot" />
      {ACTION_STATUS_LABELS[status]}
    </span>
  );
}

export function DemoBadge() {
  return <span className="badge demo" title="Données fictives du compte de démonstration">Démo</span>;
}

export function CategoryBadge({ category }: { category: MailCategory }) {
  const tone = category === "to_handle" ? "wait" : category === "newsletter" || category === "notification" ? "" : "accent";
  return <span className={`badge ${tone}`}>{MAIL_CATEGORY_LABELS[category]}</span>;
}

export function Disclosure({ title, children }: { title: string; children: ReactNode }) {
  return <details className="simple-disclosure"><summary>{title}<span aria-hidden="true">+</span></summary><div className="disclosure-body">{children}</div></details>;
}

export function Card({ title, actions, children, compact, className, collapsible }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; compact?: boolean; className?: string; collapsible?: boolean }) {
  if (collapsible) return <details className={`card panel-card simple-disclosure section-disclosure ${className ?? ""}`}><summary>{title}<span aria-hidden="true">+</span></summary>{children}</details>;
  return (
    <section className={`card panel-card ${compact ? "compact" : ""} ${className ?? ""}`}>
      {(title || actions) && (
        <div className="card-head">
          <h3 className="grow ellipsis">{title}</h3>
          {actions && <div className="row">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export function PageHead({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="page-head">
      <div className="stack-8">
        <h1>{title}</h1>
        {subtitle && <p className="muted small">{subtitle}</p>}
      </div>
      {actions && <div className="row wrap">{actions}</div>}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}

export function Loading() {
  return (
    <div className="empty" aria-busy="true">
      <span className="typing" aria-label="Chargement">
        <i />
        <i />
        <i />
      </span>
    </div>
  );
}

export function Seg<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
