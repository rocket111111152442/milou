import type * as React from "react";
import { cn } from "../lib/cn";

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden="true" className={cn("skeleton rounded-md", className)} {...props} />;
}

/** Bloc de chargement accessible : annonce le chargement aux lecteurs d'écran. */
export function LoadingBlock({ lines = 3, label = "Chargement en cours" }: { lines?: number; label?: string }) {
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-3">
      <span className="sr-only">{label}</span>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={cn("h-4", i === lines - 1 ? "w-2/3" : "w-full")} />
      ))}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed border-line-strong bg-surface/60 px-6 py-14 text-center",
        className,
      )}
    >
      {icon ? (
        <div className="relative mb-5 grid size-14 place-items-center rounded-2xl border border-line bg-white text-ink [&_svg]:size-6">
          <span aria-hidden="true" className="absolute -inset-px rounded-2xl border-gradient opacity-60" />
          {icon}
        </div>
      ) : null}
      <h3 className="font-display text-lg font-semibold">{title}</h3>
      {description ? <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-fg">{description}</p> : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}

const calloutTones = {
  info: "border-blue/20 bg-info-soft text-ink",
  success: "border-success/20 bg-success-soft text-ink",
  warning: "border-warning/25 bg-warning-soft text-ink",
  danger: "border-danger/25 bg-danger-soft text-ink",
  neutral: "border-line bg-surface text-ink",
} as const;

export function Callout({
  tone = "info",
  title,
  children,
  icon,
  className,
  role,
}: {
  tone?: keyof typeof calloutTones;
  title?: React.ReactNode;
  children?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
  role?: "alert" | "status";
}) {
  return (
    <div role={role} className={cn("flex gap-3 rounded-xl border p-4 text-sm", calloutTones[tone], className)}>
      {icon ? <div className="mt-0.5 shrink-0 [&_svg]:size-4">{icon}</div> : null}
      <div className="flex flex-col gap-1">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className="leading-relaxed text-ink-soft">{children}</div> : null}
      </div>
    </div>
  );
}

const dotTones = {
  up: "bg-success text-success",
  down: "bg-danger text-danger",
  degraded: "bg-warning text-warning",
  unknown: "bg-muted text-muted",
  active: "bg-blue text-blue",
  paused: "bg-line-strong text-line-strong",
} as const;

export function StatusDot({
  tone,
  pulse = false,
  label,
  className,
}: {
  tone: keyof typeof dotTones;
  pulse?: boolean;
  label?: string;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span
        aria-hidden="true"
        className={cn("size-2 shrink-0 rounded-full", dotTones[tone], pulse && "animate-pulse-dot motion-reduce:animate-none")}
      />
      {label ? <span className="text-sm">{label}</span> : <span className="sr-only">{tone}</span>}
    </span>
  );
}

export function Progress({
  value,
  max,
  label,
  className,
}: {
  value: number;
  max: number;
  label: string;
  className?: string;
}) {
  const ratio = max > 0 ? Math.min(1, value / max) : 0;
  const tone = ratio >= 1 ? "bg-danger" : ratio >= 0.8 ? "bg-warning" : "bg-waverti-gradient";
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-ink-soft">{label}</span>
        <span className="font-medium tabular-nums">
          {value} <span className="text-muted-fg">/ {max}</span>
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={value}
        className="h-1.5 overflow-hidden rounded-full bg-surface-strong"
      >
        <div
          className={cn("h-full rounded-full transition-[width] duration-500 ease-[var(--ease-out-soft)]", tone)}
          style={{ width: `${ratio * 100}%` }}
        />
      </div>
    </div>
  );
}

export function Stat({
  label,
  value,
  hint,
  icon,
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-2 rounded-xl border border-line bg-white p-5", className)}>
      <div className="flex items-center justify-between text-sm text-muted-fg">
        <span>{label}</span>
        {icon ? <span className="text-muted [&_svg]:size-4">{icon}</span> : null}
      </div>
      <div className="font-display text-3xl font-semibold tracking-tight tabular-nums">{value}</div>
      {hint ? <div className="text-xs text-muted-fg">{hint}</div> : null}
    </div>
  );
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-line bg-surface px-1 font-sans text-[11px] text-ink-soft">
      {children}
    </kbd>
  );
}

export function Separator({ className }: { className?: string }) {
  return <hr className={cn("border-0 border-t border-line", className)} />;
}
