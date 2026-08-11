// Shared, design-token-driven components (Section 19.1).

import { type ReactNode } from "react";

export function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "danger";
}) {
  const cls =
    variant === "primary"
      ? "rr-btn-primary"
      : variant === "danger"
        ? "rr-btn-danger"
        : "rr-btn-ghost";
  return (
    <button className={`${cls} ${className}`} {...props}>
      {children}
    </button>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className="rr-input" {...props} />;
}

export function Badge({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <span className={`rr-badge ${className}`}>{children}</span>;
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`rr-card p-4 ${className}`}>{children}</div>;
}

export function Panel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`rr-panel p-5 ${className}`}>{children}</div>;
}

export function Spinner({ label }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-rr-subtle">
      <span className="inline-block h-3 w-3 animate-spin rounded-full border border-rr-hairline border-t-rr-accent" />
      {label ? <span className="text-xs">{label}</span> : null}
    </span>
  );
}

export function Progress({
  value,
  max = 100,
  label,
}: {
  value: number;
  max?: number;
  label?: string;
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="w-full">
      {label ? (
        <div className="mb-1 flex justify-between text-xs text-rr-subtle">
          <span>{label}</span>
          <span>{Math.round(pct)}%</span>
        </div>
      ) : null}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-rr-surfaceAlt">
        <div
          className="h-full rounded-full bg-rr-accent transition-[width]"
          style={{ width: `${pct}%` }}
        />
      </div>
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
    <div className="flex flex-col items-center justify-center gap-3 rounded-panel border border-dashed border-rr-hairline p-10 text-center">
      {icon ? <div className="text-3xl opacity-70">{icon}</div> : null}
      <div className="text-sm font-medium text-rr-text">{title}</div>
      {description ? (
        <p className="max-w-sm text-xs text-rr-subtle">{description}</p>
      ) : null}
      {action}
    </div>
  );
}
