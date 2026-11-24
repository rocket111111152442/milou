import Link from "next/link";
import { PIPELINE, TEMPERATURES, INTENT_LABELS } from "@/config/crm";
import { listContacts } from "@/lib/crm/queries";
import { ContactLink, Empty, PriorityBadge, StatusBadge, TempBadge, fmtDate, intentLabel } from "@/components/admin/ui";

export const metadata = { title: "Prospectos" };
type SP = Record<string, string | undefined>;

export default async function Prospects({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const f = { q: sp.q?.slice(0, 80), status: sp.status, intent: sp.intent, temperature: sp.temperature, priority: sp.priority === "1", from: sp.from, to: sp.to, page: Number(sp.page) || 1 };
  const { rows, total, page, pages } = await listContacts(f);
  const qs = (p: number) => {
    const u = new URLSearchParams(Object.entries(sp).filter(([, v]) => v) as [string, string][]);
    u.set("page", String(p));
    return `?${u}`;
  };
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-display text-3xl font-semibold">Prospectos</h1>
        <p className="text-sm text-ink-muted">{total} resultado(s)</p>
      </div>
      {sp.deleted && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">Prospecto eliminado.</p>}
      <form className="grid gap-3 rounded-2xl border border-navy-100 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8" role="search">
        <div className="xl:col-span-2"><label className="field-label" htmlFor="q">Buscar</label><input id="q" name="q" defaultValue={sp.q} className="field" placeholder="Nombre, correo, teléfono…" /></div>
        <div><label className="field-label" htmlFor="status">Estado</label><select id="status" name="status" defaultValue={sp.status ?? ""} className="field"><option value="">Todos</option>{PIPELINE.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}</select></div>
        <div><label className="field-label" htmlFor="intent">Proyecto</label><select id="intent" name="intent" defaultValue={sp.intent ?? ""} className="field"><option value="">Todos</option>{Object.entries(INTENT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
        <div><label className="field-label" htmlFor="temperature">Interés</label><select id="temperature" name="temperature" defaultValue={sp.temperature ?? ""} className="field"><option value="">Todos</option>{TEMPERATURES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}</select></div>
        <div><label className="field-label" htmlFor="from">Desde</label><input id="from" name="from" type="date" defaultValue={sp.from} className="field" /></div>
        <div><label className="field-label" htmlFor="to">Hasta</label><input id="to" name="to" type="date" defaultValue={sp.to} className="field" /></div>
        <div className="flex items-end gap-2">
          <label className="flex min-h-[44px] items-center gap-2 text-sm"><input type="checkbox" name="priority" value="1" defaultChecked={sp.priority === "1"} className="h-4 w-4 accent-[#EB6500]" /> Prioritarios</label>
        </div>
        <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-4 xl:col-span-8">
          <button className="btn-dark min-h-[40px]">Filtrar</button>
          <Link href="/admin/prospectos" className="btn-ghost min-h-[40px]">Restablecer</Link>
        </div>
      </form>
      {rows.length === 0 ? <Empty>No hay prospectos con estos criterios.</Empty> : (
        <div className="overflow-x-auto rounded-2xl border border-navy-100 bg-white">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="bg-navy-50 text-navy-700">
              <tr>{["Nombre", "Contacto", "Proyecto", "Estado", "Interés", "Próxima acción", "Última actividad"].map((h) => <th key={h} scope="col" className="px-4 py-3 font-semibold">{h}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className="border-t border-navy-100 align-top hover:bg-navy-50/40">
                  <td className="px-4 py-3"><ContactLink id={c.id} name={c.fullName} />{c.priority && <span className="ml-2"><PriorityBadge /></span>}<p className="text-xs text-ink-soft">{c.country ?? ""}</p></td>
                  <td className="px-4 py-3 text-ink-muted">{c.phone ?? ""}<br />{c.email ?? ""}</td>
                  <td className="px-4 py-3">{intentLabel(c.criteria?.intent)}</td>
                  <td className="px-4 py-3"><StatusBadge s={c.status} /></td>
                  <td className="px-4 py-3"><TempBadge t={c.temperature} /></td>
                  <td className="px-4 py-3">{c.nextAction ?? "—"}<p className={`text-xs ${c.nextActionAt && new Date(c.nextActionAt) < new Date() ? "font-semibold text-red-700" : "text-ink-soft"}`}>{fmtDate(c.nextActionAt)}</p></td>
                  <td className="px-4 py-3 text-ink-muted">{fmtDate(c.lastActivityAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {pages > 1 && (
        <nav className="flex items-center gap-2" aria-label="Paginación">
          {page > 1 && <Link className="btn-outline min-h-[38px]" href={qs(page - 1)}>Anterior</Link>}
          <span className="text-sm text-ink-muted">Página {page} de {pages}</span>
          {page < pages && <Link className="btn-outline min-h-[38px]" href={qs(page + 1)}>Siguiente</Link>}
        </nav>
      )}
    </div>
  );
}
