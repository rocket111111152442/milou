import Link from "next/link";
import { pipelineLabel, temperatureLabel, appointmentLabel, INTENT_LABELS } from "@/config/crm";

export const fmtDate = (d: Date | string | null | undefined, withTime = true) =>
  d ? new Intl.DateTimeFormat("es-DO", { timeZone: "America/Santo_Domingo", dateStyle: "medium", ...(withTime ? { timeStyle: "short" } : {}) }).format(new Date(d)) : "—";

const TEMP_STYLE: Record<string, string> = { caliente: "bg-red-50 text-red-800 ring-red-200", tibio: "bg-amber-50 text-amber-900 ring-amber-200", frio: "bg-sky-50 text-sky-900 ring-sky-200" };
export function TempBadge({ t }: { t: string }) {
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${TEMP_STYLE[t] ?? "bg-navy-50"}`}>{temperatureLabel(t)}</span>;
}
export function StatusBadge({ s }: { s: string }) {
  return <span className="inline-flex rounded-full bg-navy-50 px-2 py-0.5 text-xs font-semibold text-navy-700 ring-1 ring-navy-100">{pipelineLabel(s)}</span>;
}
export function ApptBadge({ s }: { s: string }) {
  const c = s === "solicitada" ? "bg-amber-50 text-amber-900" : s === "confirmada" ? "bg-emerald-50 text-emerald-800" : "bg-navy-50 text-navy-700";
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${c}`}>{appointmentLabel(s)}</span>;
}
export function PriorityBadge() {
  return <span className="inline-flex rounded-full bg-brand px-2 py-0.5 text-xs font-semibold text-white">Prioritario</span>;
}
export const intentLabel = (i?: string | null) => (i ? INTENT_LABELS[i] ?? i : "—");

export function Card({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-navy-100 bg-white p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-navy">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-xl bg-navy-50 p-4 text-sm text-ink-muted">{children}</p>;
}

export function ContactLink({ id, name }: { id: number; name: string }) {
  return <Link href={`/admin/prospectos/${id}`} className="font-medium text-navy hover:text-brand-600 hover:underline">{name}</Link>;
}
