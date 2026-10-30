import type { Metadata } from "next";
import { AlertTriangle, CircleCheck } from "lucide-react";
import { Badge, Callout, Card, CardContent, CardHeader, CardTitle, PageHeader, Stat } from "@waverti/ui";
import { formatCents, formatRelative } from "@waverti/types";
import { detectAnomalies, getAdminKpis } from "@/lib/data/admin";

export const metadata: Metadata = { title: "Vue d'ensemble" };

const euros = (micros: number) => `${(micros / 1e6).toFixed(2).replace(".", ",")} €`;
const PROVIDER = { brave_search: "Recherche Web (Brave)", resend: "E-mails (Resend)", playwright: "Navigateur (serveur)", http_fetch: "Requêtes HTTP", tls_check: "Contrôles HTTPS" } as Record<string, string>;

export default async function AdminHome() {
  const k = await getAdminKpis();
  const anomalies = detectAnomalies(k);
  const conversion = k.trials.converted30d + k.trials.canceled30d > 0 ? k.trials.converted30d / (k.trials.converted30d + k.trials.canceled30d) : null;
  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Vue d'ensemble" description="Indicateurs calculés en direct à partir de la base de données. Aucune valeur n'est estimée sans le dire." />

      <section aria-labelledby="anomalies" className="flex flex-col gap-3">
        <h2 id="anomalies" className="font-display text-lg font-bold">
          Points d'attention
        </h2>
        {anomalies.length ? (
          anomalies.map((a) => (
            <Callout key={a.title} tone={a.severity === "high" ? "danger" : a.severity === "medium" ? "warning" : "neutral"} icon={<AlertTriangle />} title={a.title}>
              {a.detail}
            </Callout>
          ))
        ) : (
          <Callout tone="success" icon={<CircleCheck />} title="Aucune anomalie détectée" />
        )}
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="p-5">
          <Stat label="Comptes" value={String(k.users.total)} hint={`+${k.users.new7d} en 7 j · +${k.users.new30d} en 30 j · ${k.users.suspended} suspendu(s)`} />
        </Card>
        <Card className="p-5">
          <Stat label="Revenu mensuel récurrent" value={formatCents(k.mrrCents)} hint="Abonnements actifs non résiliés × prix TTC (hors remises)" />
        </Card>
        <Card className="p-5">
          <Stat
            label="Encaissé sur 30 jours"
            value={formatCents(k.collected30d.cents)}
            hint={`${k.collected30d.invoices} facture(s) Stripe payée(s)${k.collected30d.liveMode ? "" : " · MODE TEST, aucun encaissement réel"}`}
          />
        </Card>
        <Card className="p-5">
          <Stat
            label="Essais (30 jours)"
            value={`${k.trials.started30d} démarrés`}
            hint={`${k.trials.converted30d} convertis · ${k.trials.canceled30d} annulés · ${k.trials.inProgress} en cours${conversion === null ? "" : ` · conversion ${Math.round(conversion * 100)} %`}`}
          />
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Formules</CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <caption className="sr-only">Répartition des comptes par formule</caption>
              <thead>
                <tr className="text-left text-muted-fg">
                  <th scope="col" className="py-2">Formule</th>
                  <th scope="col" className="py-2 text-right">Actifs</th>
                  <th scope="col" className="py-2 text-right">En essai</th>
                  <th scope="col" className="py-2 text-right">Impayés</th>
                </tr>
              </thead>
              <tbody>
                {k.plans.map((p) => (
                  <tr key={p.planId} className="border-t border-line">
                    <th scope="row" className="py-2 text-left font-medium">
                      {p.name}
                    </th>
                    <td className="py-2 text-right tabular-nums">{p.active}</td>
                    <td className="py-2 text-right tabular-nums">{p.trialing}</td>
                    <td className="py-2 text-right tabular-nums">{p.pastDue}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-xs text-muted-fg">
              Comptes sans abonnement ni essai : {k.users.withoutSubscription}. Résiliations sur 30 jours : {k.cancellations30d}.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Activité</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 text-sm">
            <Stat label="Surveillances de pages" value={String(k.monitors.page)} hint={`${k.monitors.errors} en erreur · ${k.monitors.paused} en pause`} />
            <Stat label="Sujets Internet" value={String(k.monitors.webTopic)} />
            <Stat label="Ordinateurs reliés" value={String(k.devices.total)} hint={`${k.devices.online} en ligne · ${k.devices.consented} avec accord local`} />
            <Stat label="Sites Business" value={`${k.business.verified}/${k.business.sites} vérifiés`} hint={`${k.business.endpoints} points de contrôle · ${k.business.openIncidents} incident(s) ouvert(s)`} />
            <Stat label="Contrôles (24 h)" value={`${k.jobs24h.succeeded} réussis`} hint={`${k.jobs24h.failed} en échec · ${k.jobs24h.pending} en attente`} />
            <Stat label="E-mails (24 h)" value={`${k.emails24h.sent} envoyés`} hint={`${k.emails24h.failed} en échec · ${k.emails24h.pending} en attente`} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Coûts du mois (estimés)</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <p>
              <span className="font-display text-2xl font-bold">{euros(k.costs.monthMicros)}</span>{" "}
              <span className="text-muted-fg">sur un budget de {k.costs.budgetEur} €</span>
            </p>
            <ul className="flex flex-col gap-1">
              {k.costs.byProvider.map((p) => (
                <li key={p.provider} className="flex justify-between gap-4 border-t border-line pt-1">
                  <span>{PROVIDER[p.provider] ?? p.provider}</span>
                  <span className="tabular-nums text-muted-fg">
                    {p.units} unité(s) · {p.cacheHits} via cache · {euros(p.micros)}
                  </span>
                </li>
              ))}
              {k.costs.byProvider.length === 0 ? <li className="text-muted-fg">Aucune consommation ce mois-ci.</li> : null}
            </ul>
            <p className="text-xs text-muted-fg">Estimation à partir des tarifs unitaires configurés (app_settings), à rapprocher des factures des fournisseurs.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Workers (serveur)</CardTitle>
          </CardHeader>
          <CardContent>
            {k.workers.length ? (
              <ul className="flex flex-col gap-2 text-sm">
                {k.workers.map((w) => (
                  <li key={w.workerId} className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-2">
                    <span className="font-medium">
                      {w.hostname} <span className="text-muted-fg">({w.role})</span>
                    </span>
                    <span className="flex items-center gap-2 text-muted-fg">
                      <Badge tone={w.online ? "success" : "danger"}>{w.online ? "En ligne" : "Hors ligne"}</Badge>
                      vu {formatRelative(w.lastSeenAt)} · {w.succeeded} réussis / {w.failed} échecs
                    </span>
                    {w.loopErrors.length ? (
                      <span className="w-full text-xs text-danger">
                        {w.loopErrors.map((l) => `${l.loop} : ${l.errors} erreur(s)${l.lastError ? ` (${l.lastError})` : ""}`).join(" · ")}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-fg">Aucun worker n'a encore signalé son activité.</p>
            )}
            <p className="mt-3 text-xs text-muted-fg">
              Événements Stripe en échec : {k.billingEventsFailed} · Demandes d'assistance ouvertes : {k.openTickets}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
