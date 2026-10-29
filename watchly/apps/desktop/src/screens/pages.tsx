import * as React from "react";
import { Bell, ExternalLink, Pause, Play, Plus, RefreshCw, Trash2 } from "lucide-react";
import {
  Badge,
  Button,
  Callout,
  Card,
  Dialog,
  DialogClose,
  DialogContent,
  DialogTrigger,
  EmptyState,
  Input,
  LoadingBlock,
  PageHeader,
  useToast,
} from "@watchly/ui";
import {
  MonitorForm,
  MonitorList,
  MonitorStatusBadge,
  NotificationList,
  OverviewView,
  ResultTimeline,
  type FormEntitlements,
  type PreviewResult,
  type TopicPlan,
} from "@watchly/ui/app";
import { extractPage } from "@watchly/monitoring/extract";
import { formatDateTime, formatInterval, formatRelative, type MonitorSummary, type NotificationView, type OverviewData, type ResultView } from "@watchly/types";
import { api, ApiError } from "../lib/api";
import type { ActivityEntry, AgentSnapshot, LocalAgent } from "../lib/agent";
import { native } from "../lib/native";
import { useRenderLink, useRouter } from "../lib/router";

/** Chargement d'une ressource de l'API avec rechargement manuel. */
function useResource<T>(path: string | null, deps: unknown[] = []) {
  const [data, setData] = React.useState<T | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [version, setVersion] = React.useState(0);
  React.useEffect(() => {
    if (!path) return;
    let alive = true;
    setError(null);
    api<T>("GET", path)
      .then((d) => alive && setData(d))
      .catch((e: Error) => alive && setError(e.message));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, version, ...deps]);
  return { data, error, reload: () => setVersion((v) => v + 1) };
}

function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Callout tone="danger" title="Chargement impossible" role="alert">
      <p>{message}</p>
      <Button variant="secondary" size="sm" className="mt-2 self-start" onClick={onRetry}>
        <RefreshCw aria-hidden="true" /> Réessayer
      </Button>
    </Callout>
  );
}

export interface OverviewResponse {
  overview: OverviewData;
  cloudRelay: boolean;
  entitlements: FormEntitlements & { planId: string };
}

export function OverviewPage({ webBase, snapshot }: { webBase: string; snapshot: AgentSnapshot }) {
  const { data, error, reload } = useResource<OverviewResponse>("/api/overview");
  const renderLink = useRenderLink(webBase);
  const checksToday = snapshot.activity.filter((a) => a.at > Date.now() - 86_400_000 && a.outcome !== "skipped").length;
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Vue d'ensemble" description="Vos surveillances, vos alertes et l'activité de cet ordinateur." />
      <Card className="flex flex-col gap-2 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <AgentDot phase={snapshot.phase} />
          <div>
            <p className="font-medium">{PHASE_LABEL[snapshot.phase]}</p>
            <p className="text-sm text-muted-fg">
              {checksToday} contrôle(s) effectué(s) sur cet ordinateur depuis 24 h
              {snapshot.lastContactAt ? ` · dernier contact avec Watchly ${formatRelative(new Date(snapshot.lastContactAt).toISOString())}` : ""}
            </p>
          </div>
        </div>
      </Card>
      {error ? <LoadError message={error} onRetry={reload} /> : null}
      {!data && !error ? <LoadingBlock lines={6} /> : null}
      {data ? (
        <OverviewView
          data={data.overview}
          cloudRelay={data.cloudRelay}
          renderLink={renderLink}
          newMonitorHref="/surveillances/nouvelle"
          alertsHref="/alertes"
          subscriptionHref={`${webBase}/app/abonnement`}
          monitorHref={(id) => `/surveillances/${id}`}
        />
      ) : null}
    </div>
  );
}

export function MonitorsPage({ webBase }: { webBase: string }) {
  const [q, setQ] = React.useState("");
  const [query, setQuery] = React.useState("");
  const { data, error, reload } = useResource<{ monitors: MonitorSummary[] }>(`/api/monitors${query ? `?q=${encodeURIComponent(query)}` : ""}`);
  const renderLink = useRenderLink(webBase);
  const { navigate } = useRouter();
  React.useEffect(() => {
    const t = window.setTimeout(() => setQuery(q.trim()), 300);
    return () => window.clearTimeout(t);
  }, [q]);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Mes surveillances"
        actions={
          <Button onClick={() => navigate("/surveillances/nouvelle")}>
            <Plus aria-hidden="true" /> Nouvelle surveillance
          </Button>
        }
      />
      <Input type="search" placeholder="Rechercher par nom…" aria-label="Rechercher une surveillance" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm" />
      {error ? <LoadError message={error} onRetry={reload} /> : null}
      {!data && !error ? <LoadingBlock lines={5} /> : null}
      {data ? (
        <MonitorList
          monitors={data.monitors}
          hrefFor={(m) => `/surveillances/${m.id}`}
          renderLink={renderLink}
          emptyAction={<Button onClick={() => navigate("/surveillances/nouvelle")}>Créer ma première surveillance</Button>}
        />
      ) : null}
    </div>
  );
}

/** Analyse locale d'une page (même moteur que les contrôles de cet ordinateur). */
async function previewLocally(agent: LocalAgent, url: string, cssSelector?: string): Promise<PreviewResult> {
  try {
    const parsed = new URL(url);
    if (!(await agent.robotsAllowed(parsed))) {
      return { ok: false, error: { code: "robots_disallowed", message: "Le site interdit l'accès automatisé à cette page (robots.txt)." } };
    }
    const page = await native.fetchPage(url);
    const o = extractPage({ html: page.body, url, finalUrl: page.finalUrl, httpStatus: page.status, cssSelector: cssSelector || null, method: "http" });
    return {
      ok: true,
      observation: {
        title: o.title,
        price: o.price,
        currency: o.currency,
        priceSource: o.priceSource,
        availability: o.availability,
        availabilitySource: o.availabilitySource,
        selectorFound: o.selectorFound,
        httpStatus: o.httpStatus,
        finalUrl: o.finalUrl,
      },
    };
  } catch (e) {
    const err = e as { code?: string; message?: string };
    return { ok: false, error: { code: err.code ?? "error", message: err.message ?? "Analyse impossible." } };
  }
}

export function NewMonitorPage({ webBase, agent }: { webBase: string; agent: LocalAgent }) {
  const { data, error, reload } = useResource<OverviewResponse>("/api/overview");
  const { navigate } = useRouter();
  const { push } = useToast();
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Nouvelle surveillance" description="L'aperçu de la page est calculé directement sur cet ordinateur." />
      {error ? <LoadError message={error} onRetry={reload} /> : null}
      {!data && !error ? <LoadingBlock lines={6} /> : null}
      {data ? (
        <MonitorForm
          entitlements={data.entitlements}
          upgradeHref={`${webBase}/app/abonnement`}
          onPreview={(url, sel) => previewLocally(agent, url, sel)}
          onPlanTopic={async (request, officialDomains) => {
            try {
              return await api<TopicPlan>("POST", "/api/monitors/plan-topic", { request, officialDomains });
            } catch {
              return null;
            }
          }}
          onSubmit={async (input) => {
            try {
              const created = await api<{ id: string }>("POST", "/api/monitors", input);
              push({ tone: "success", title: "Surveillance créée", description: "Le premier contrôle va être lancé." });
              navigate(`/surveillances/${created.id}`);
              return { ok: true };
            } catch (e) {
              const err = e as ApiError;
              return {
                ok: false,
                message: err.message,
                fieldErrors: Object.fromEntries((err.issues ?? []).map((i) => [i.path.split(".").pop() ?? i.path, i.message])),
              };
            }
          }}
        />
      ) : null}
    </div>
  );
}

interface MonitorDetail {
  monitor: {
    id: string;
    name: string;
    kind: "page" | "web_topic";
    status: MonitorSummary["status"];
    conditionLabel: string;
    executionMode: string;
    url: string | null;
    topic: string | null;
    intervalMinutes: number | null;
    nextRunAt: string | null;
    lastError: string | null;
  };
  results: ResultView[];
}

const MODE_LABEL: Record<string, string> = {
  auto: "Cet ordinateur en priorité, relais par les serveurs Watchly si besoin",
  local_only: "Uniquement sur cet ordinateur",
  cloud_only: "Uniquement par les serveurs Watchly",
};

export function MonitorDetailPage({ id }: { id: string }) {
  const { data, error, reload } = useResource<MonitorDetail>(`/api/monitors/${encodeURIComponent(id)}`);
  const { navigate } = useRouter();
  const { push } = useToast();
  const [busy, setBusy] = React.useState<string | null>(null);
  const act = async (name: string, method: "POST" | "DELETE", path: string, success: string) => {
    setBusy(name);
    try {
      await api(method, path, method === "POST" ? {} : undefined);
      push({ tone: "success", title: success });
      if (method === "DELETE") navigate("/surveillances");
      else reload();
    } catch (e) {
      push({ tone: "error", title: "Action impossible", description: (e as Error).message });
    } finally {
      setBusy(null);
    }
  };
  if (error) return <LoadError message={error} onRetry={reload} />;
  if (!data) return <LoadingBlock lines={8} />;
  const m = data.monitor;
  const paused = m.status === "paused" || m.status === "paused_quota";
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={m.name}
        description={m.conditionLabel}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" loading={busy === "check"} onClick={() => void act("check", "POST", `/api/monitors/${m.id}/check`, "Contrôle demandé")}>
              <RefreshCw aria-hidden="true" /> Vérifier maintenant
            </Button>
            {paused ? (
              <Button variant="secondary" size="sm" loading={busy === "resume"} onClick={() => void act("resume", "POST", `/api/monitors/${m.id}/resume`, "Surveillance reprise")}>
                <Play aria-hidden="true" /> Reprendre
              </Button>
            ) : (
              <Button variant="secondary" size="sm" loading={busy === "pause"} onClick={() => void act("pause", "POST", `/api/monitors/${m.id}/pause`, "Surveillance en pause")}>
                <Pause aria-hidden="true" /> Mettre en pause
              </Button>
            )}
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="ghost" size="sm">
                  <Trash2 aria-hidden="true" /> Supprimer
                </Button>
              </DialogTrigger>
              <DialogContent title="Supprimer cette surveillance ?" description="L'historique des contrôles sera également supprimé. Cette action est définitive.">
                <div className="mt-6 flex justify-end gap-2">
                  <DialogClose asChild>
                    <Button variant="secondary">Annuler</Button>
                  </DialogClose>
                  <Button variant="danger" loading={busy === "delete"} onClick={() => void act("delete", "DELETE", `/api/monitors/${m.id}`, "Surveillance supprimée")}>
                    Supprimer
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        }
      />
      <Card className="grid gap-4 p-5 text-sm sm:grid-cols-2">
        <div>
          <p className="text-muted-fg">État</p>
          <div className="mt-1">
            <MonitorStatusBadge
              monitor={{ status: m.status, lastStatus: !data.results[0] ? "pending" : data.results[0].outcome === "error" ? "error" : data.results[0].outcome === "triggered" ? "triggered" : "ok" }}
            />
          </div>
        </div>
        <div>
          <p className="text-muted-fg">Fréquence</p>
          <p className="mt-1 font-medium">{m.intervalMinutes ? formatInterval(m.intervalMinutes) : "—"}</p>
        </div>
        <div>
          <p className="text-muted-fg">Prochain contrôle</p>
          <p className="mt-1 font-medium">{!paused && m.nextRunAt ? formatDateTime(m.nextRunAt) : "—"}</p>
        </div>
        <div>
          <p className="text-muted-fg">Exécution</p>
          <p className="mt-1 font-medium">{m.kind === "web_topic" ? "Serveurs Watchly (recherche sur Internet)" : (MODE_LABEL[m.executionMode] ?? m.executionMode)}</p>
        </div>
        {m.url ? (
          <div className="sm:col-span-2">
            <p className="text-muted-fg">Page surveillée</p>
            <button type="button" className="mt-1 inline-flex max-w-full items-center gap-1.5 break-all text-left font-medium text-blue hover:underline" onClick={() => void native.openExternal(m.url!)}>
              {m.url} <ExternalLink className="size-3.5 shrink-0" aria-hidden="true" />
            </button>
          </div>
        ) : null}
        {m.topic ? (
          <div className="sm:col-span-2">
            <p className="text-muted-fg">Sujet</p>
            <p className="mt-1 font-medium">{m.topic}</p>
          </div>
        ) : null}
      </Card>
      {m.lastError ? (
        <Callout tone="warning" title="Dernière erreur">
          {m.lastError}
        </Callout>
      ) : null}
      <section className="flex flex-col gap-3">
        <h2 className="font-display text-lg font-bold">Historique des contrôles</h2>
        <ResultTimeline results={data.results} />
      </section>
    </div>
  );
}

export function AlertsPage() {
  const { data, error, reload } = useResource<{ notifications: NotificationView[] }>("/api/notifications?limit=100");
  const { push } = useToast();
  const markRead = async (body: { ids: string[] } | { all: true }) => {
    try {
      await api("POST", "/api/notifications/read", body);
      reload();
    } catch (e) {
      push({ tone: "error", title: "Action impossible", description: (e as Error).message });
    }
  };
  const unread = data?.notifications.filter((n) => !n.readAt).length ?? 0;
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Alertes"
        description="Les alertes sont aussi affichées en notification sur cet ordinateur."
        actions={
          unread ? (
            <Button variant="secondary" size="sm" onClick={() => void markRead({ all: true })}>
              Tout marquer comme lu
            </Button>
          ) : null
        }
      />
      {error ? <LoadError message={error} onRetry={reload} /> : null}
      {!data && !error ? <LoadingBlock lines={5} /> : null}
      {data ? (
        data.notifications.length ? (
          <NotificationList
            items={data.notifications}
            onMarkRead={(id) => void markRead({ ids: [id] })}
            renderOpenLink={(n) =>
              n.sourceUrl ? (
                <button type="button" className="text-sm font-medium text-blue hover:underline" onClick={() => void native.openExternal(n.sourceUrl!)}>
                  Ouvrir la page
                </button>
              ) : null
            }
          />
        ) : (
          <EmptyState icon={<Bell />} title="Aucune alerte pour l'instant" description="Vous serez prévenu ici dès qu'une condition sera remplie." />
        )
      ) : null}
    </div>
  );
}

export const PHASE_LABEL: Record<AgentSnapshot["phase"], string> = {
  starting: "Démarrage de l'agent local…",
  needs_consent: "Contrôles locaux en attente de votre accord",
  disabled: "Contrôles locaux désactivés",
  paused: "Contrôles locaux en pause",
  idle: "Contrôles locaux actifs",
  running: "Contrôle en cours sur cet ordinateur",
  offline: "Serveur Watchly injoignable — nouvel essai automatique",
};

/** Pastille décorative : le libellé de l'état est toujours affiché à côté, en texte. */
export function AgentDot({ phase }: { phase: AgentSnapshot["phase"] }) {
  const color =
    phase === "idle" || phase === "running" ? "bg-success" : phase === "offline" ? "bg-danger" : phase === "paused" || phase === "disabled" ? "bg-line-strong" : "bg-warning";
  return (
    <span
      aria-hidden="true"
      className={`inline-block size-2.5 shrink-0 rounded-full ${color} ${phase === "running" ? "animate-pulse-dot motion-reduce:animate-none" : ""}`}
    />
  );
}

const OUTCOME: Record<ActivityEntry["outcome"], { label: string; tone: "success" | "info" | "danger" | "neutral" }> = {
  ok: { label: "Effectué", tone: "success" },
  triggered: { label: "Alerte", tone: "info" },
  error: { label: "Erreur", tone: "danger" },
  skipped: { label: "Non transmis", tone: "neutral" },
};

/** Transparence : tout ce que cet ordinateur a fait pour Watchly depuis le lancement. */
export function ActivityPage({ snapshot }: { snapshot: AgentSnapshot }) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Activité de cet ordinateur" description="Les contrôles exécutés ici depuis le lancement de l'application (100 derniers)." />
      <Card className="flex items-center gap-3 p-5">
        <AgentDot phase={snapshot.phase} />
        <p className="font-medium">{PHASE_LABEL[snapshot.phase]}</p>
        {snapshot.lastError ? <span className="text-sm text-muted-fg">({snapshot.lastError})</span> : null}
      </Card>
      <Callout tone="neutral" title="Ce que fait Watchly sur cet ordinateur">
        Uniquement les contrôles de pages de VOTRE compte : lecture de la page publique (sans vos cookies ni vos identifiants), respect du fichier
        robots.txt des sites, au moins 5 secondes entre deux requêtes vers un même site, aucune adresse de votre réseau local. Les recherches sur
        Internet sont faites par les serveurs Watchly.
      </Callout>
      {snapshot.activity.length === 0 ? (
        <EmptyState title="Aucun contrôle effectué depuis le lancement" description="Les contrôles apparaissent ici au fur et à mesure." />
      ) : (
        <ul className="divide-y divide-line rounded-2xl border border-line bg-white">
          {snapshot.activity.map((a) => (
            <li key={`${a.at}-${a.taskName}`} className="flex flex-col gap-1 px-5 py-3 sm:flex-row sm:items-center sm:gap-4">
              <span className="w-36 shrink-0 text-sm text-muted-fg tabular-nums">{formatDateTime(new Date(a.at).toISOString())}</span>
              <span className="flex-1">
                <span className="font-medium">{a.taskName}</span>
                {a.host ? <span className="text-sm text-muted-fg"> · {a.host}</span> : null}
                <span className="block text-sm text-muted-fg">{a.detail}</span>
              </span>
              <Badge tone={OUTCOME[a.outcome].tone}>{OUTCOME[a.outcome].label}</Badge>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
