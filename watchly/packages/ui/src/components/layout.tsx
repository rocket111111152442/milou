import type * as React from "react";
import { cn } from "../lib/cn";

export function Container({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mx-auto w-full max-w-[1200px] px-4 sm:px-6 lg:px-8", className)} {...props} />;
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "center",
  className,
  id,
  as: Tag = "h2",
}: {
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  align?: "center" | "left";
  className?: string;
  id?: string;
  /** h1 quand la section ouvre une page autonome (SEO, accessibilité). */
  as?: "h1" | "h2";
}) {
  return (
    <div className={cn("flex flex-col gap-4", align === "center" ? "mx-auto max-w-2xl items-center text-center" : "max-w-2xl", className)}>
      {eyebrow ? (
        <span className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-3 py-1 text-xs font-medium uppercase tracking-[0.08em] text-ink-soft">
          <span aria-hidden="true" className="size-1.5 rounded-full bg-watchly-gradient" />
          {eyebrow}
        </span>
      ) : null}
      <Tag id={id} className="font-display text-[32px] font-bold leading-[1.1] tracking-[-0.03em] text-ink sm:text-[44px]">
        {title}
      </Tag>
      {description ? <p className="text-base leading-relaxed text-muted-fg sm:text-lg">{description}</p> : null}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-4 pb-6 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="flex flex-col gap-1.5">
        <h1 className="font-display text-2xl font-bold tracking-[-0.025em] sm:text-[28px]">{title}</h1>
        {description ? <p className="text-sm text-muted-fg sm:text-[15px]">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
