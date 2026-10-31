import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink, Pencil } from "lucide-react";
import { Badge, Button, Callout, Card, CardContent, CardHeader, CardTitle, LineChart, PageHeader } from "@waverti/ui";
import { MonitorStatusBadge, ResultTimeline } from "@waverti/ui/app";
import { isUuid } from "@waverti/database";
import { describeRule, formatDateTime, formatInterval, formatRelative, ruleConditionSchema, STATUS_LABELS, type WebFinding } from "@waverti/types";
import { requireUser } from "@/lib/auth";
import { loadEntitlements } from "@/lib/data/account";
import { conditionLabel, getMonitorDetail, toResultView } from "@/lib/data/monitors";
import { MonitorActions } from "./monitor-actions";

export const metadata: Metadata = { title: "Surveillance" };

const EXEC_LABEL = { auto: "Ordinateur en priorité, serveurs en relais", local_only: "Uniquement sur votre ordinateur", cloud_only: "Uniquement sur les serveurs Waverti" } as const;
const CLASS_TONE = { confirmed: "success", probable: "info", rumor: "warning", irrelevant: "neutral" } as const;

export default async function MonitorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(`/app/surveillances/${id}`);
  if (!isUuid(id)) notFound();
  const [d, ent] = await Promise.all([getMonitorDetail(user.id, id), loadEntitlements(user.id)]);
  if (!d) notFound();
  const { task, target, schedule } = d;
  const results = d.results.map((r) => toResultView(r, task.condition));
  const prices = d.series
    .map((s) => ({ t: s.checkedAt.toISOString(), v: typeof (s.observation as { price?: unknown } | null)?.price === "number" ? ((s.observation as { price: number }).price) : null }))
    .filter((p) => p.v !== null);
  const latestWeb = d.results.find((r) => (r.observation as { kind?: string } | null)?.kind === "web_topic")?.observation as
    | { status: keyof typeof STATUS_LABELS; findings: WebFinding[] }
    | undefined;

  const ruleParsed = ruleConditionSchema.safeParse(task.condition);
  const ruleLines = ruleParsed.success ? describeRule(ruleParsed.data) : [];

  return (
    <div className="flex flex-col gap-6">
      <nav aria-label="Fil d'Ariane" className="text-sm text-muted-fg">
        <Link href="/app/surveillances" className="hover:text-ink">
          Mes surveillances
        </Link>{" "}
        / <span aria-current="page">{task.name}</span>
      </nav>
      <PageHeader
        title={task.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <MonitorStatusBadge monitor={{ status: task.status, lastStatus: task.lastStatus }} />
            <span>{conditionLabel(task.condition)}</span>
          </span>
        }
        actions={
          <>
            <Button asChild variant="secondary" size="sm">
              <Link href={`/app/surveillances/${task.id}/modifier`}>
                <Pencil aria-hidden="true" /> Modifier
              </Link>
            </Button>
            <MonitorActions id={task.id} status={task.status} canExport={ent.dataExports} />
          </>
        }
      />
      {task.status === "paused_quota" ? (
        <Callout tone="warning" title="Surveillance suspendue">
          Votre formule actuelle ne permet pas autant de surveillances. Supprimez-en une autre ou changez de formule pour la réactiver.
        </Callout>
      ) : null}
      {task.lastError && task.lastStatus === "error" ? (
        <Callout tone="danger" title="Dernier contrôle en erreur">
          {task.lastError}
        </Callout>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="flex flex-col gap-6">
          {ruleLines.length ? (
            <Card>
              <CardHeader>
                <CardTitle as="h2">Règle d'alerte</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="flex flex-col gap-1.5 text-sm" aria-label="Conditions de la règle">
                  {ruleLines.map((l, i) => (
                    <li key={i}>{l}</li>
                  ))}
                </ul>
                {target?.cssSelector ? <p className="mt-3 text-xs text-muted-fg">Zone surveillée : {target.cssSelector}</p> : null}
              </CardContent>
            </Card>
          ) : null}
          {task.kind === "page" && prices.length > 1 ? (
            <Card>
              <CardHeader>
                <CardTitle as="h2">Évolution du prix (90 jours)</CardTitle>
              </CardHeader>
              <CardContent>
                <LineChart points={prices} unit=" €" label={`Évolution du prix de ${task.name}`} formatValue={(v) => `${Math.round(v)} €`} />
              </CardContent>
            </Card>
          ) : null}
          {latestWeb ? (
            <Card>
              <CardHeader>
                <CardTitle as="h2">Dernières informations trouvées</CardTitle>
                <p className="text-sm text-muted-fg">État : {STATUS_LABELS[latestWeb.status]}</p>
              </CardHeader>
              <CardContent>
                {latestWeb.findings.length === 0 ? (
                  <p className="text-sm text-muted-fg">Aucune information pertinente pour l'instant.</p>
                ) : (
                  <ul className="flex flex-col divide-y divide-line">
                    {latestWeb.findings.slice(0, 8).map((f) => (
                      <li key={f.fingerprint + f.url} className="flex flex-col gap-1 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone={CLASS_TONE[f.classification]}>{STATUS_LABELS[f.classification === "irrelevant" ? "none" : f.classification]}</Badge>
                          <span className="text-xs text-muted-fg">{f.domain}</span>
                        </div>
                        <a href={f.url} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 font-medium hover:text-blue">
                          {f.title} <ExternalLink className="size-3.5" aria-hidden="true" />
                        </a>
                        <p className="text-sm text-muted-fg">{f.snippet}</p>
                        {f.reasons[0] ? <p className="text-xs text-muted-fg">Pourquoi : {f.reasons[0]}</p> : null}
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          ) : null}
          <Card>
            <CardHeader>
              <CardTitle as="h2">Historique des contrôles</CardTitle>
            </CardHeader>
            <CardContent>
              <ResultTimeline results={results} emptyLabel="Le premier contrôle est en attente. Il apparaîtra ici dès qu'il sera effectué." />
            </CardContent>
          </Card>
        </div>
        <Card className="h-fit">
          <CardHeader>
            <CardTitle as="h2">Réglages</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="flex flex-col gap-4 text-sm">
              {target?.url ? (
                <div>
                  <dt className="text-muted-fg">Page</dt>
                  <dd>
                    <a href={target.url} target="_blank" rel="noopener noreferrer nofollow" className="break-all text-blue hover:underline">
                      {target.url}
                    </a>
                  </dd>
                </div>
              ) : null}
              {target?.topic ? (
                <div>
                  <dt className="text-muted-fg">Demande</dt>
                  <dd>{target.topic}</dd>
                </div>
              ) : null}
              {target?.officialDomains?.length ? (
                <div>
                  <dt className="text-muted-fg">Sources officielles</dt>
                  <dd>{target.officialDomains.join(", ")}</dd>
                </div>
              ) : null}
              {target?.cssSelector ? (
                <div>
                  <dt className="text-muted-fg">Zone surveillée</dt>
                  <dd className="font-mono text-xs">{target.cssSelector}</dd>
                </div>
              ) : null}
              <div>
                <dt className="text-muted-fg">Fréquence</dt>
                <dd>{schedule ? formatInterval(schedule.intervalMinutes) : "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-fg">Prochaine vérification</dt>
                <dd>{task.status === "active" || task.status === "error" ? (schedule ? formatRelative(schedule.nextRunAt.toISOString()) : "—") : "En pause"}</dd>
              </div>
              <div>
                <dt className="text-muted-fg">Exécution</dt>
                <dd>{task.kind === "web_topic" ? "Serveurs Waverti (moteur de recherche)" : EXEC_LABEL[task.executionMode]}</dd>
              </div>
              <div>
                <dt className="text-muted-fg">Notifications</dt>
                <dd>
                  Application{task.notifyEmail && ent.emailAlerts ? ", e-mail" : ""}
                  {task.notifyDesktop ? ", bureau" : ""}
                </dd>
              </div>
              <div>
                <dt className="text-muted-fg">Créée le</dt>
                <dd>{formatDateTime(task.createdAt.toISOString(), user.timezone)}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
