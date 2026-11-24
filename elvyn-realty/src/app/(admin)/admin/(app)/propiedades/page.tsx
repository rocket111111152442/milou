import Link from "next/link";
import { desc } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { Card, Empty, fmtDate } from "@/components/admin/ui";

export const metadata = { title: "Propiedades propias" };
export const dynamic = "force-dynamic";

export default async function ManualListings() {
  const rows = await (await getDb()).select().from(schema.manualListings).orderBy(desc(schema.manualListings.updatedAt));
  const price = (p: number | null, c: string) => (p ? `${c === "DOP" ? "RD$" : "US$"}${p.toLocaleString("en-US")}` : "Precio a consultar");
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-semibold">Propiedades propias</h1>
        <Link href="/admin/propiedades/nueva" className="btn-primary">Añadir una propiedad</Link>
      </div>
      <p className="text-sm text-ink-muted">Propiedades añadidas aquí, sin pasar por AlterEstate. Aparecen en el sitio, en las búsquedas y en el asistente IA junto con las de AlterEstate.</p>
      <Card title={`${rows.length} propiedad(es)`}>
        {rows.length === 0 ? (
          <Empty>Todavía no has añadido ninguna propiedad.</Empty>
        ) : (
          <ul className="divide-y divide-navy-100">
            {rows.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                <div>
                  <Link href={`/admin/propiedades/${r.id}`} className="font-semibold text-navy hover:underline">{r.title}</Link>
                  <p className="text-ink-muted">{r.operation === "sale" ? "Venta" : "Alquiler"} · {r.city ?? "—"} · {price(r.price, r.currency)} · Ref. EA{r.id}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${r.published ? "bg-emerald-50 text-emerald-800" : "bg-navy-50 text-ink-muted"}`}>{r.published ? "Publicada" : "Borrador"}</span>
                  <span className="text-xs text-ink-soft">{fmtDate(r.updatedAt)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
