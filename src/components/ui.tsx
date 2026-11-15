import { useId, type KeyboardEvent, type ReactNode } from "react";

/** Page title row with optional description and actions, shared by every section. */
export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  eyebrow?: string;
}) {
  return (
    <header className="ws-page-header">
      <div>
        {eyebrow && <p className="ws-eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {description && <p className="ws-page-description">{description}</p>}
      </div>
      {actions && <div className="ws-page-actions">{actions}</div>}
    </header>
  );
}

export type Tone = "neutral" | "info" | "success" | "warning" | "danger";

/** Compact KPI tile. */
export function StatTile({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: Tone;
}) {
  return (
    <div className={`ws-stat ws-tone-${tone}`}>
      <span className="ws-stat-label">{label}</span>
      <strong className="ws-stat-value">{value}</strong>
      {hint && <span className="ws-stat-hint">{hint}</span>}
    </div>
  );
}

export function Pill({
  tone = "neutral",
  children,
}: {
  tone?: Tone;
  children: ReactNode;
}) {
  return <span className={`ws-pill ws-tone-${tone}`}>{children}</span>;
}

export function Panel({
  title,
  actions,
  children,
  id,
}: {
  title?: string;
  actions?: ReactNode;
  children: ReactNode;
  id?: string;
}) {
  const generated = useId();
  const headingId = id ?? generated;
  return (
    <section
      className="ws-panel"
      aria-labelledby={title ? headingId : undefined}
    >
      {(title || actions) && (
        <div className="ws-panel-header">
          {title && <h2 id={headingId}>{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="ws-empty">{children}</p>;
}

/** Accessible tabs (WAI-ARIA tablist with arrow-key navigation). */
export function Tabs<T extends string>({
  label,
  tabs,
  active,
  onChange,
}: {
  label: string;
  tabs: { id: T; label: string; count?: number }[];
  active: T;
  onChange: (id: T) => void;
}) {
  const base = useId();
  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const step =
      event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = tabs[(index + step + tabs.length) % tabs.length];
    onChange(next.id);
    document.getElementById(`${base}-${next.id}`)?.focus();
  }
  return (
    <div className="ws-tabs" role="tablist" aria-label={label}>
      {tabs.map((tab, index) => (
        <button
          key={tab.id}
          id={`${base}-${tab.id}`}
          role="tab"
          type="button"
          aria-selected={tab.id === active}
          tabIndex={tab.id === active ? 0 : -1}
          className="ws-tab"
          onClick={() => onChange(tab.id)}
          onKeyDown={(event) => onKeyDown(event, index)}
        >
          {tab.label}
          {tab.count !== undefined && (
            <span className="ws-tab-count">{tab.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}

export function initials(email: string) {
  const name = email.split("@")[0] ?? "";
  const parts = name.split(/[._-]+/).filter(Boolean);
  return (
    (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? parts[0]?.[1] ?? "")
  ).toUpperCase();
}

export function Avatar({
  email,
  size = "md",
}: {
  email: string;
  size?: "sm" | "md" | "lg";
}) {
  return (
    <span className={`ws-avatar ws-avatar-${size}`} aria-hidden="true">
      {initials(email)}
    </span>
  );
}
