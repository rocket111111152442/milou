import Link from "next/link";
import { APPOINTMENT_STATUS } from "@/config/crm";
import { listAppointments } from "@/lib/crm/queries";
import { getCalendar } from "@/lib/calendar";
import { ApptBadge, ContactLink, Empty, fmtDate } from "@/components/admin/ui";

export const metadata = { title: "Visitas" };

export default async function Visits({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const rows = await listAppointments(status);
  const cal = getCalendar();
  return (
    <div className="space-y-5">
      <h1 className="font-display text-3xl font-semibold">Visitas</h1>
      <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-950">
        {cal.connected ? `Calendario conectado: ${cal.name}.` : "Ningún calendario externo conectado: las solicitudes quedan pendientes hasta que confirmes un horario desde la ficha del prospecto. El CRM impide confirmar dos visitas que se solapen."}
      </p>
      <nav className="flex flex-wrap gap-2" aria-label="Filtrar por estado">
        <Link href="/admin/citas" className={`chip min-h-[36px] ${!status ? "bg-navy text-white" : ""}`}>Todas</Link>
        {APPOINTMENT_STATUS.map((s) => <Link key={s.key} href={`/admin/citas?status=${s.key}`} className={`chip min-h-[36px] ${status === s.key ? "bg-navy text-white" : ""}`}>{s.label}</Link>)}
      </nav>
      {rows.length === 0 ? <Empty>No hay visitas.</Empty> : (
        <div className="overflow-x-auto rounded-2xl border border-navy-100 bg-white">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-navy-50"><tr>{["Estado", "Cliente", "Tipo", "Propiedad", "Preferencias", "Fecha confirmada"].map((h) => <th key={h} scope="col" className="px-4 py-3 font-semibold">{h}</th>)}</tr></thead>
            <tbody>
              {rows.map(({ a, name }) => (
                <tr key={a.id} className="border-t border-navy-100 align-top">
                  <td className="px-4 py-3"><ApptBadge s={a.status} /></td>
                  <td className="px-4 py-3"><ContactLink id={a.contactId} name={name} /></td>
                  <td className="px-4 py-3">{a.type === "virtual" ? "Videollamada" : "Presencial"}</td>
                  <td className="px-4 py-3">{a.propertyTitle ?? "—"}</td>
                  <td className="px-4 py-3 text-ink-muted">{a.preferredSlots.map((s) => s.replace("T", " ")).join(" / ") || "—"}</td>
                  <td className="px-4 py-3">{fmtDate(a.startsAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
