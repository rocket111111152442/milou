import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, PageHeader } from "@watchly/ui";
import { costsByPlan, getAdminKpis, topCostUsers } from "@/lib/data/admin";

export const metadata: Metadata = { title: "Coûts" };
const euros = (micros: number) => `${(Number(micros) / 1e6).toFixed(2).replace(".", ",")} €`;

export default async function AdminCosts() {
  const [byPlan, top, k] = await Promise.all([costsByPlan(), topCostUsers(), getAdminKpis()]);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Coûts d'exploitation (mois en cours)"
        description={`Estimation à partir des tarifs unitaires configurés : ${euros(k.costs.monthMicros)} pour un budget de ${k.costs.budgetEur} €. À rapprocher des factures réelles des fournisseurs.`}
      />
      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Par formule</CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <caption className="sr-only">Coûts par formule</caption>
              <thead>
                <tr className="text-left text-muted-fg">
                  <th scope="col" className="py-2">Formule</th>
                  <th scope="col" className="py-2 text-right">Comptes</th>
                  <th scope="col" className="py-2 text-right">Unités</th>
                  <th scope="col" className="py-2 text-right">Coût</th>
                  <th scope="col" className="py-2 text-right">Par compte</th>
                </tr>
              </thead>
              <tbody>
                {byPlan.map((r) => (
                  <tr key={r.plan_id ?? "x"} className="border-t border-line">
                    <th scope="row" className="py-2 text-left font-medium">
                      {r.plan_id}
                    </th>
                    <td className="py-2 text-right tabular-nums">{r.users}</td>
                    <td className="py-2 text-right tabular-nums">{r.units}</td>
                    <td className="py-2 text-right tabular-nums">{euros(r.micros)}</td>
                    <td className="py-2 text-right tabular-nums">{r.users ? euros(Number(r.micros) / r.users) : "—"}</td>
                  </tr>
                ))}
                {byPlan.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-muted-fg">
                      Aucune consommation ce mois-ci.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Comptes les plus coûteux</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-1 text-sm">
              {top.map((u) => (
                <li key={u.user_id} className="flex justify-between gap-4 border-t border-line pt-1">
                  <Link className="text-blue hover:underline" href={`/admin/utilisateurs/${u.user_id}`}>
                    {u.email ?? u.user_id}
                  </Link>
                  <span className="tabular-nums text-muted-fg">
                    {u.units} unité(s) · {euros(u.micros)}
                  </span>
                </li>
              ))}
              {top.length === 0 ? <li className="text-muted-fg">Aucune consommation ce mois-ci.</li> : null}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
