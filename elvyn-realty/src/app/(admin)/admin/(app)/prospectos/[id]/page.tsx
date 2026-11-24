import Link from "next/link";
import { notFound } from "next/navigation";
import { getContactDetail } from "@/lib/crm/queries";
import { ApptBadge, Card, Empty, PriorityBadge, StatusBadge, TempBadge, fmtDate, intentLabel } from "@/components/admin/ui";
import { ConfirmVisitForm, ContactEditForm, NoteForm } from "@/components/admin/forms";
import { changeVisitStatus, removeContact } from "../../../actions";
import { whatsappLink } from "@/config/site";

export const metadata = { title: "Prospecto" };

const ACTIVITY: Record<string, string> = {
  created: "Prospecto creado",
  inquiry: "Nueva solicitud",
  updated: "Datos actualizados",
  visit_requested: "Visita solicitada",
  visit_confirmed: "Visita confirmada",
  visit_cancelada: "Visita cancelada",
  visit_realizada: "Visita realizada",
  visit_no_asistio: "No asistió a la visita",
  visit_solicitada: "Visita devuelta a pendiente",
  data_differs: "Datos distintos recibidos (no sobrescritos)",
  possible_duplicate: "Posible duplicado detectado",
};

export default async function ProspectPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const d = await getContactDetail(Number(id));
  if (!d) notFound();
  const c = d.contact;
  const crit = c.criteria ?? {};
  const critRows: [string, string | undefined | null][] = [
    ["Proyecto", intentLabel(crit.intent)],
    ["Tipo de propiedad", crit.propertyTypes?.join(", ")],
    ["Zonas", crit.zones?.join(", ")],
    ["Presupuesto", crit.budgetMin || crit.budgetMax ? `${crit.currency ?? "USD"} ${[crit.budgetMin, crit.budgetMax].filter(Boolean).map((n) => n!.toLocaleString("en-US")).join(" – ")}` : null],
    ["Precio esperado (venta)", crit.expectedPrice ? `${crit.currency ?? "USD"} ${crit.expectedPrice.toLocaleString("en-US")}` : null],
    ["Forma de pago", crit.paymentMethod],
    ["Uso", crit.usage],
    ["Plazo", crit.timeline],
    ["Habitaciones", crit.bedrooms?.toString()],
    ["Imprescindibles", crit.mustHaves?.join(", ")],
    ["Visita preferida", crit.visitPreference === "virtual" ? "Videollamada" : crit.visitPreference === "physical" ? "Presencial" : null],
    ["Disponibilidad", crit.availability],
    ["Título deslindado", crit.titleDeslindado],
    ["Hipoteca", crit.hasMortgage],
    ["Personas / fechas", [crit.guests, crit.dates].filter(Boolean).join(" · ") || null],
    ["Cómo nos conoció", c.howFound],
  ];
  const properties = [...new Map(d.inquiries.filter((i) => i.propertySlug).map((i) => [i.propertySlug!, i])).values()];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/admin/prospectos" className="text-sm text-ink-muted hover:underline">← Prospectos</Link>
          <h1 className="mt-1 font-display text-3xl font-semibold">{c.fullName}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2"><StatusBadge s={c.status} /> <TempBadge t={c.temperature} /> {c.priority && <PriorityBadge />} <span className="text-xs text-ink-soft">Creado {fmtDate(c.createdAt)} · Origen: {c.source}</span></div>
        </div>
        <div className="flex flex-wrap gap-2">
          {c.phone && <a className="btn-whatsapp min-h-[40px]" href={whatsappLink(undefined, c.phone)} target="_blank" rel="noopener noreferrer">WhatsApp</a>}
          {c.phone && <a className="btn-outline min-h-[40px]" href={`tel:${c.phone}`}>Llamar</a>}
          {c.email && <a className="btn-outline min-h-[40px]" href={`mailto:${c.email}`}>Correo</a>}
          <a className="btn-ghost min-h-[40px]" href={`/admin/prospectos/${c.id}/export`}>Exportar datos (JSON)</a>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <div className="space-y-6">
          <Card title="Ficha y seguimiento">
            <p className="mb-4 rounded-xl bg-navy-50 p-3 text-xs text-ink-muted">
              Nivel calculado con reglas explícitas (configurables en <code>src/config/crm.ts</code>): es una estimación para organizar los seguimientos, no una certeza.
              {c.temperatureManual ? " Nivel ajustado manualmente: ya no se recalcula automáticamente." : ""}
              {c.priorityReason ? ` Prioridad: ${c.priorityReason}.` : ""}
            </p>
            <ContactEditForm c={{ ...c, birthDate: c.birthDate ?? null }} />
          </Card>
          <Card title="Criterios">
            <dl className="grid gap-x-6 sm:grid-cols-2">
              {critRows.filter(([, v]) => v).map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3 border-b border-navy-100 py-2 text-sm"><dt className="text-ink-muted">{k}</dt><dd className="text-right font-medium">{v}</dd></div>
              ))}
            </dl>
            {critRows.every(([, v]) => !v) && <Empty>Sin criterios registrados.</Empty>}
          </Card>
          <Card title="Solicitudes">
            {d.inquiries.length === 0 ? <Empty>Sin solicitudes.</Empty> : (
              <ul className="space-y-3">
                {d.inquiries.map((i) => (
                  <li key={i.id} className="rounded-xl border border-navy-100 p-3 text-sm">
                    <p className="text-xs text-ink-soft">{fmtDate(i.createdAt)} · {i.channel === "chat" ? "Asistente IA" : "Formulario web"} · {i.kind}{i.reason ? ` · motivo: ${i.reason}` : ""}</p>
                    {i.propertySlug && <p className="mt-1">Propiedad: <a className="text-brand-700 underline" href={`/propiedad/${i.propertySlug}`} target="_blank" rel="noopener noreferrer">{i.propertyTitle ?? i.propertySlug}</a>{i.propertyRef ? ` (Ref. ${i.propertyRef})` : ""}</p>}
                    {i.summary && <p className="mt-1 whitespace-pre-line text-ink">{i.summary}</p>}
                    {i.message && <p className="mt-1 whitespace-pre-line rounded-lg bg-sand p-2 text-ink-muted">“{i.message}”</p>}
                  </li>
                ))}
              </ul>
            )}
          </Card>
          {d.transcripts.length > 0 && (
            <Card title="Conversación con el asistente">
              <p className="mb-3 text-xs text-ink-muted">Se conserva según la duración configurada (CHAT_RETENTION_DAYS) y luego se elimina; el resumen permanece en la solicitud.</p>
              <ol className="max-h-[420px] space-y-2 overflow-y-auto">
                {d.transcripts.map((t) => {
                  const disp = t.display as { text?: string; cards?: { title: string }[] };
                  return (
                    <li key={`${t.sessionId}-${t.seq}`} className={`rounded-xl p-2.5 text-sm ${t.role === "user" ? "ml-8 bg-navy text-white" : "mr-8 bg-navy-50"}`}>
                      <p className="whitespace-pre-line">{disp.text}</p>
                      {disp.cards?.length ? <p className="mt-1 text-xs opacity-80">Fichas mostradas: {disp.cards.map((c) => c.title).join(" · ")}</p> : null}
                    </li>
                  );
                })}
              </ol>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card title="Visitas">
            {d.appointments.length === 0 ? <Empty>Sin solicitudes de visita.</Empty> : (
              <ul className="space-y-4">
                {d.appointments.map((a) => (
                  <li key={a.id} className="rounded-xl border border-navy-100 p-3 text-sm">
                    <div className="flex flex-wrap items-center gap-2"><ApptBadge s={a.status} /> <span>{a.type === "virtual" ? "Videollamada" : "Presencial"}</span> <span className="text-xs text-ink-soft">#{a.id}</span></div>
                    <p className="mt-1">{a.propertyTitle ?? "Sin propiedad concreta"}</p>
                    <p className="text-ink-muted">Preferencias del cliente ({a.timezone ?? "zona no indicada"}): {a.preferredSlots.map((s) => s.replace("T", " ")).join(" / ") || "—"}</p>
                    {a.startsAt && <p className="mt-1 font-semibold">Confirmada: {fmtDate(a.startsAt)}</p>}
                    {a.meetingUrl && <p><a className="text-brand-700 underline" href={a.meetingUrl} target="_blank" rel="noopener noreferrer">Enlace de videollamada</a></p>}
                    {a.outcome && <p className="text-ink-muted">Resultado: {a.outcome}</p>}
                    {(a.status === "solicitada" || a.status === "confirmada") && <ConfirmVisitForm appointmentId={a.id} virtual={a.type === "virtual"} meetingUrl={a.meetingUrl} />}
                    <form action={changeVisitStatus} className="mt-2 flex flex-wrap items-end gap-2">
                      <input type="hidden" name="appointmentId" value={a.id} />
                      <label className="sr-only" htmlFor={`oc-${a.id}`}>Resultado</label>
                      <input id={`oc-${a.id}`} name="outcome" className="field min-h-[38px] flex-1 py-1.5 text-sm" placeholder="Resultado / motivo (opcional)" />
                      <select name="status" className="field min-h-[38px] w-auto py-1.5 text-sm" defaultValue="realizada" aria-label="Nuevo estado">
                        <option value="realizada">Realizada</option>
                        <option value="no_asistio">No asistió</option>
                        <option value="cancelada">Cancelada</option>
                        <option value="solicitada">Volver a pendiente</option>
                      </select>
                      <button className="btn-outline min-h-[38px] text-sm">Actualizar</button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card title="Propiedades de interés">
            {properties.length === 0 ? <Empty>Ninguna propiedad concreta.</Empty> : (
              <ul className="space-y-1.5 text-sm">{properties.map((i) => <li key={i.propertySlug}><a className="text-brand-700 underline" href={`/propiedad/${i.propertySlug}`} target="_blank" rel="noopener noreferrer">{i.propertyTitle ?? i.propertySlug}</a>{i.propertyRef ? ` · Ref. ${i.propertyRef}` : ""}</li>)}</ul>
            )}
          </Card>
          <Card title="Notas internas">
            <NoteForm contactId={c.id} />
            <ul className="mt-4 space-y-2">
              {d.notes.map((n) => <li key={n.id} className="rounded-xl bg-sand p-3 text-sm"><p className="whitespace-pre-line">{n.body}</p><p className="mt-1 text-xs text-ink-soft">{n.author ?? "—"} · {fmtDate(n.createdAt)}</p></li>)}
            </ul>
          </Card>
          <Card title="Historial">
            <ol className="space-y-1.5 text-sm">
              {d.activities.map((a) => <li key={a.id} className="flex justify-between gap-3"><span>{ACTIVITY[a.kind] ?? a.kind}</span><span className="shrink-0 text-xs text-ink-soft">{fmtDate(a.createdAt)}</span></li>)}
            </ol>
          </Card>
          <Card title="Notificaciones enviadas">
            {d.notifications.length === 0 ? <Empty>Ninguna.</Empty> : (
              <ul className="space-y-1 text-sm">{d.notifications.map((n) => <li key={n.id} className="flex justify-between gap-3"><span>{n.event} · {n.channel}</span><span className="text-xs text-ink-soft">{n.status}</span></li>)}</ul>
            )}
          </Card>
          <Card title="Eliminar datos">
            {sp.error === "confirm" && <p role="alert" className="mb-2 text-sm text-red-700">Escribe ELIMINAR para confirmar.</p>}
            <form action={removeContact} className="space-y-2">
              <input type="hidden" name="contactId" value={c.id} />
              <p className="text-sm text-ink-muted">Elimina definitivamente el prospecto, sus solicitudes, visitas, notas y conversaciones. Exporta antes si necesitas una copia.</p>
              <label className="field-label" htmlFor="confirm">Escribe ELIMINAR</label>
              <input id="confirm" name="confirm" className="field" autoComplete="off" />
              <button className="btn min-h-[40px] bg-red-700 text-white hover:bg-red-800">Eliminar definitivamente</button>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
