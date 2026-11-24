import Link from "next/link";
import { dashboardData } from "@/lib/crm/queries";
import { usageSummary } from "@/lib/ai/usage";
import { creditStatus } from "@/lib/ai/credits";
import { TokenGauge } from "@/components/admin/TokenGauge";
import { Card, ContactLink, Empty, PriorityBadge, TempBadge, fmtDate } from "@/components/admin/ui";

export const metadata = { title: "Panel" };

export default async function Dashboard() {
  const [d, usage, credit] = await Promise.all([dashboardData(), usageSummary(), creditStatus()]);
  const stats = [
    { label: "Nuevos (sin tratar)", value: d.counts.nuevos, href: "/admin/prospectos?status=nuevo" },
    { label: "Calientes activos", value: d.counts.calientes, href: "/admin/prospectos?temperature=caliente" },
    { label: "Prioritarios activos", value: d.counts.prioritarios, href: "/admin/prospectos?priority=1" },
    { label: "Acciones vencidas", value: d.counts.vencidas, href: "/admin/prospectos" },
    { label: "Visitas por confirmar", value: d.pendingVisits.length, href: "/admin/citas?status=solicitada" },
    { label: "Prospectos (7 días)", value: d.counts.semana, href: "/admin/prospectos" },
  ];
  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-semibold">Panel</h1>
      <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {stats.map((s) => (
          <li key={s.label}>
            <Link href={s.href} className="block rounded-2xl border border-navy-100 bg-white p-4 hover:border-navy-200 hover:shadow-card">
              <p className="text-3xl font-semibold text-navy">{s.value}</p>
              <p className="mt-1 text-xs text-ink-muted">{s.label}</p>
            </Link>
          </li>
        ))}
      </ul>
      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="Próximas acciones">
          {d.nextActions.length === 0 ? <Empty>No hay acciones programadas.</Empty> : (
            <ul className="divide-y divide-navy-100">
              {d.nextActions.map((c) => {
                const late = c.nextActionAt && new Date(c.nextActionAt) < new Date();
                return (
                  <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                    <span className="flex items-center gap-2"><ContactLink id={c.id} name={c.fullName} /> <TempBadge t={c.temperature} /> {c.priority && <PriorityBadge />}</span>
                    <span className={late ? "font-semibold text-red-700" : "text-ink-muted"}>{c.nextAction ?? "—"} · {fmtDate(c.nextActionAt)}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
        <Card title="Visitas pendientes de confirmación" action={<Link className="text-sm text-brand-600 hover:underline" href="/admin/citas">Ver todas</Link>}>
          {d.pendingVisits.length === 0 ? <Empty>No hay solicitudes de visita pendientes.</Empty> : (
            <ul className="divide-y divide-navy-100">
              {d.pendingVisits.map(({ a, name }) => (
                <li key={a.id} className="py-2.5 text-sm">
                  <ContactLink id={a.contactId} name={name} /> · {a.type === "virtual" ? "Videollamada" : "Presencial"}
                  <p className="text-ink-muted">{a.propertyTitle ?? "Sin propiedad"} · Preferencias: {a.preferredSlots.join(" / ") || "—"}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Últimas solicitudes" action={<Link className="text-sm text-brand-600 hover:underline" href="/admin/prospectos">Prospectos</Link>}>
          {d.recent.length === 0 ? <Empty>Todavía no hay solicitudes.</Empty> : (
            <ul className="divide-y divide-navy-100">
              {d.recent.map(({ i, name, temperature, priority }) => (
                <li key={i.id} className="py-2.5 text-sm">
                  <div className="flex flex-wrap items-center gap-2"><ContactLink id={i.contactId} name={name} /> <TempBadge t={temperature} /> {priority && <PriorityBadge />} <span className="text-xs text-ink-soft">{fmtDate(i.createdAt)} · {i.channel === "chat" ? "Asistente" : "Formulario"}</span></div>
                  <p className="mt-0.5 line-clamp-2 text-ink-muted">{i.summary}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Visitas confirmadas próximas">
          {d.upcoming.length === 0 ? <Empty>No hay visitas confirmadas próximamente.</Empty> : (
            <ul className="divide-y divide-navy-100">
              {d.upcoming.map(({ a, name }) => (
                <li key={a.id} className="py-2.5 text-sm"><span className="font-semibold">{fmtDate(a.startsAt)}</span> · <ContactLink id={a.contactId} name={name} /> · {a.propertyTitle ?? "—"}</li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Asistente IA" action={<Link href="/admin/asistente" className="text-sm font-medium text-brand-dark hover:underline">Recargar</Link>}>
          <TokenGauge s={credit} compact />
          <p className="mt-2 text-xs text-ink-muted">Mensajes de visitantes hoy: {usage.todayTurns} (límite diario {usage.dailyTurnLimit}).</p>
        </Card>
      </div>
    </div>
  );
}
