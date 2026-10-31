import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, PageHeader } from "@waverti/ui";
import { providerMonthSummary } from "@waverti/database";
import { costsByPlan, getAdminKpis, topCostUsers } from "@/lib/data/admin";
import { getDb } from "@/lib/db";
import { ActualCostForm } from "./actual-cost-form";

const PROVIDER_LABEL: Record<string, string> = { brave_search: "Brave Search", resend: "Resend", smtp: "SMTP", vercel: "Vercel", server: "Serveur", other: "Autre" };

export const metadata: Metadata = { title: "Coûts" };
const euros = (micros: number) => `${(Number(micros) / 1e6).toFixed(2).replace(".", ",")} €`;

export default async function AdminCosts() {
  const month = new Date().toISOString().slice(0, 7);
  const [byPlan, top, k, providers] = await Promise.all([costsByPlan(), topCostUsers(), getAdminKpis(), providerMonthSummary(getDb(), month)]);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Coûts d'exploitation (mois en cours)"
        description={`Estimation à partir des tarifs unitaires configurés : ${euros(k.costs.monthMicros)} pour un budget de ${k.costs.budgetEur} €. À rapprocher des factures réelles des fournisseurs.`}
      />
      <Card>
        <CardHeader>
          <CardTitle>Appels aux fournisseurs ({month}) — compteur technique</CardTitle>
          <p className="text-sm text-muted-fg">
            Chaque requête réellement envoyée (succès, échecs, nouvelles tentatives, limites de débit). Distinct des quotas des
            abonnés. Le coût réel provient de la facture du fournisseur, saisie ci-dessous.
          </p>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm" data-testid="provider-requests">
              <caption className="sr-only">Appels aux fournisseurs ce mois-ci</caption>
              <thead>
                <tr className="text-left text-muted-fg">
                  <th scope="col" className="py-2">Fournisseur</th>
                  <th scope="col" className="py-2 text-right">Requêtes</th>
                  <th scope="col" className="py-2 text-right">Succès</th>
                  <th scope="col" className="py-2 text-right">Échecs</th>
                  <th scope="col" className="py-2 text-right">Limite de débit</th>
                  <th scope="col" className="py-2 text-right">Nouvelles tentatives</th>
                  <th scope="col" className="py-2 text-right">Coût estimé</th>
                  <th scope="col" className="py-2 text-right">Coût réel</th>
                  <th scope="col" className="py-2 text-right">Quota fournisseur</th>
                </tr>
              </thead>
              <tbody>
                {providers.map((p) => (
                  <tr key={p.provider} className="border-t border-line">
                    <th scope="row" className="py-2 text-left font-medium">
                      {PROVIDER_LABEL[p.provider] ?? p.provider}
                    </th>
                    <td className="py-2 text-right tabular-nums">{p.requests}</td>
                    <td className="py-2 text-right tabular-nums">{p.successes}</td>
                    <td className="py-2 text-right tabular-nums">{p.failures + p.timeouts}</td>
                    <td className="py-2 text-right tabular-nums">{p.rateLimited}</td>
                    <td className="py-2 text-right tabular-nums">{p.retries}</td>
                    <td className="py-2 text-right tabular-nums">{euros(p.estimatedCostMicros)}</td>
                    <td className="py-2 text-right tabular-nums">{p.actualCostMicros === null ? "non saisi" : euros(p.actualCostMicros)}</td>
                    <td className="py-2 text-right tabular-nums">
                      {p.lastQuotaRemaining === null ? "—" : `${p.lastQuotaRemaining} / ${p.lastQuotaLimit ?? "?"}`}
                    </td>
                  </tr>
                ))}
                {providers.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-6 text-center text-muted-fg">
                      Aucun appel ce mois-ci.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <ActualCostForm month={month} />
        </CardContent>
      </Card>
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
