import type { Metadata } from "next";
import { Card, PageHeader } from "@watchly/ui";
import { formatDateTime } from "@watchly/types";
import { listAudit } from "@/lib/data/admin";

export const metadata: Metadata = { title: "Journal d'audit" };

export default async function AdminAudit() {
  const rows = await listAudit();
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Journal d'audit" description="Toutes les actions d'administration, avec leur auteur et leur motif (200 dernières)." />
      <Card className="overflow-x-auto p-0">
        <table className="w-full min-w-[720px] text-sm">
          <caption className="sr-only">Actions d'administration</caption>
          <thead>
            <tr className="border-b border-line bg-surface text-left">
              <th scope="col" className="px-4 py-3">Date</th>
              <th scope="col" className="px-4 py-3">Action</th>
              <th scope="col" className="px-4 py-3">Cible</th>
              <th scope="col" className="px-4 py-3">Auteur</th>
              <th scope="col" className="px-4 py-3">Motif</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-line last:border-0">
                <td className="px-4 py-3 tabular-nums">{formatDateTime(r.created_at)}</td>
                <td className="px-4 py-3 font-medium">{r.action}</td>
                <td className="px-4 py-3">
                  {r.target_type} {r.target_id ? r.target_id.slice(0, 8) : ""}
                </td>
                <td className="px-4 py-3">{r.admin_email ?? "script (ligne de commande)"}</td>
                <td className="px-4 py-3">{r.reason ?? "—"}</td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-fg">
                  Aucune action enregistrée.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
