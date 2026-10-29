import { cn } from "@watchly/ui";

/** Cadre de fenêtre neutre pour présenter les écrans de l'application. */
export function BrowserFrame({
  label,
  caption,
  children,
  className,
}: {
  label: string;
  caption?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <figure className={cn("overflow-hidden rounded-2xl border border-line bg-white shadow-lift", className)}>
      <div className="flex items-center gap-3 border-b border-line bg-surface px-4 py-3">
        <span aria-hidden="true" className="flex gap-1.5">
          <span className="size-2.5 rounded-full bg-line-strong" />
          <span className="size-2.5 rounded-full bg-line-strong" />
          <span className="size-2.5 rounded-full bg-line-strong" />
        </span>
        <span className="mx-auto truncate rounded-md border border-line bg-white px-3 py-1 text-xs text-muted-fg">{label}</span>
        <span aria-hidden="true" className="w-[42px]" />
      </div>
      <div className="bg-surface/50">{children}</div>
      {caption ? (
        <figcaption className="border-t border-line bg-white px-4 py-2 text-center text-[11px] uppercase tracking-[0.08em] text-muted-fg">
          {caption}
        </figcaption>
      ) : null}
    </figure>
  );
}
