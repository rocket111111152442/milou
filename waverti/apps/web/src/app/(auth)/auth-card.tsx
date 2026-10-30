export function AuthCard({ title, description, children, footer }: { title: string; description?: React.ReactNode; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-2xl border border-line bg-white p-6 shadow-soft sm:p-8">
        <h1 className="font-display text-2xl font-bold tracking-tight">{title}</h1>
        {description ? <p className="mt-2 text-sm leading-relaxed text-muted-fg">{description}</p> : null}
        <div className="mt-7">{children}</div>
      </div>
      {footer ? <div className="text-center text-sm text-muted-fg">{footer}</div> : null}
    </div>
  );
}
