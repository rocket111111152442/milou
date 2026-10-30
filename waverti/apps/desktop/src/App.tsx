import * as React from "react";
import { Activity, Bell, History, LayoutDashboard, ListChecks, Pause, Play, Plus, Settings } from "lucide-react";
import { Button, Callout, LoadingBlock, Logo, useToast } from "@waverti/ui";
import { AppShell, type NavItem } from "@waverti/ui/app";
import { api, ApiError } from "./lib/api";
import { LocalAgent, type AgentSnapshot } from "./lib/agent";
import { native, onPaused, onTick, onUnlinked, type AppInfo } from "./lib/native";
import { showDesktopNotification } from "./lib/notify";
import { RouterContext, useRenderLink } from "./lib/router";
import { ConsentScreen, type Me } from "./screens/consent";
import { LinkScreen } from "./screens/link";
import { ActivityPage, AgentDot, AlertsPage, HistoryPage, MonitorDetailPage, MonitorsPage, NewMonitorPage, OverviewPage, PHASE_LABEL } from "./screens/pages";
import { SettingsPage } from "./screens/settings";

type Stage = { name: "loading" } | { name: "unlinked" } | { name: "consent" } | { name: "ready" } | { name: "offline"; message: string };

function useAgent(info: AppInfo | null): [LocalAgent | null, AgentSnapshot | null] {
  const [agent, setAgent] = React.useState<LocalAgent | null>(null);
  const [snap, setSnap] = React.useState<AgentSnapshot | null>(null);
  React.useEffect(() => {
    if (!info) return;
    const a = new LocalAgent({
      api: (method, path, body) => api(method, path, body),
      fetchPage: native.fetchPage,
      fetchRobots: native.fetchRobots,
      notify: showDesktopNotification,
      reportStatus: (t) => void native.reportStatus(t).catch(() => undefined),
      now: () => Date.now(),
      sleep: (ms) => new Promise((r) => window.setTimeout(r, ms)),
      appVersion: info.version,
    });
    a.setPaused(info.paused);
    setAgent(a);
    return a.subscribe(setSnap);
  }, [info]);
  return [agent, snap];
}

export function App() {
  const [info, setInfo] = React.useState<AppInfo | null>(null);
  const [me, setMe] = React.useState<Me | null>(null);
  const [stage, setStage] = React.useState<Stage>({ name: "loading" });
  const [path, setPath] = React.useState("/");
  const [paused, setPausedState] = React.useState(false);
  const [agent, snapshot] = useAgent(info);
  const { push } = useToast();

  const load = React.useCallback(async () => {
    const i = await native.appInfo();
    setInfo(i);
    setPausedState(i.paused);
    if (!i.linked) return setStage({ name: "unlinked" });
    try {
      const m = await api<Me>("GET", "/api/agent/me");
      setMe(m);
      const refused = localStorage.getItem(`waverti.consent-refused.${m.device?.id}`) === "1";
      setStage(!m.consent.accepted && !refused ? { name: "consent" } : { name: "ready" });
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return setStage({ name: "unlinked" });
      setStage({ name: "offline", message: (e as Error).message });
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  // Réveils périodiques envoyés par Rust, pause depuis l'icône, révocation depuis le site.
  React.useEffect(() => {
    if (!agent || stage.name === "unlinked" || stage.name === "loading") return;
    void agent.tick();
    const subs = [
      onTick(() => void agent.tick()),
      onPaused((p) => {
        agent.setPaused(p);
        setPausedState(p);
      }),
      onUnlinked(() => {
        setMe(null);
        setStage({ name: "unlinked" });
      }),
    ];
    return () => subs.forEach((s) => void s.then((un) => un()));
  }, [agent, stage.name]);

  React.useEffect(() => {
    if (stage.name === "unlinked") void native.reportStatus("Non relié à un compte");
  }, [stage.name]);

  const togglePause = async (p: boolean) => {
    await native.setPaused(p);
    agent?.setPaused(p);
    setPausedState(p);
  };

  if (!info || stage.name === "loading") {
    return (
      <main className="grid min-h-full place-items-center p-8">
        <div className="w-full max-w-sm">
          <LoadingBlock lines={3} label="Démarrage de Waverti" />
        </div>
      </main>
    );
  }
  if (stage.name === "unlinked") return <LinkScreen info={info} onLinked={() => void load()} />;
  if (stage.name === "offline" || !me) {
    return (
      <main className="grid min-h-full place-items-center bg-surface p-8">
        <div className="flex w-full max-w-md flex-col gap-4">
          <Logo className="h-7" />
          <Callout tone="danger" title="Serveur Waverti injoignable" role="alert">
            {stage.name === "offline" ? stage.message : "Réessayez dans un instant."}
          </Callout>
          <Button onClick={() => void load()}>Réessayer</Button>
        </div>
      </main>
    );
  }
  if (stage.name === "consent") {
    return (
      <ConsentScreen
        me={me}
        onDone={(accepted) => {
          if (!accepted && me.device) localStorage.setItem(`waverti.consent-refused.${me.device.id}`, "1");
          if (accepted && me.device) localStorage.removeItem(`waverti.consent-refused.${me.device.id}`);
          push(
            accepted
              ? { tone: "success", title: "Contrôles locaux activés", description: "Waverti vérifie vos pages depuis cet ordinateur." }
              : { tone: "info", title: "Contrôles locaux désactivés", description: "Vous pourrez les activer dans les paramètres." },
          );
          void load();
        }}
      />
    );
  }

  return (
    <RouterContext.Provider value={{ path, navigate: setPath }}>
      <Main
        info={info}
        me={me}
        path={path}
        agent={agent!}
        snapshot={snapshot!}
        paused={paused}
        onPausedChange={(p) => void togglePause(p)}
        onConsent={() => setStage({ name: "consent" })}
        onUnlinked={() => {
          setMe(null);
          setStage({ name: "unlinked" });
        }}
      />
    </RouterContext.Provider>
  );
}

function Main({
  info,
  me,
  path,
  agent,
  snapshot,
  paused,
  onPausedChange,
  onConsent,
  onUnlinked,
}: {
  info: AppInfo;
  me: Me;
  path: string;
  agent: LocalAgent;
  snapshot: AgentSnapshot;
  paused: boolean;
  onPausedChange: (p: boolean) => void;
  onConsent: () => void;
  onUnlinked: () => void;
}) {
  const renderLink = useRenderLink(info.apiBase);
  const is = (p: string, exact = false) => (exact ? path === p : path === p || path.startsWith(`${p}/`));
  const nav: NavItem[] = [
    { href: "/", label: "Vue d'ensemble", icon: <LayoutDashboard />, active: is("/", true) },
    { href: "/surveillances", label: "Mes surveillances", icon: <ListChecks />, active: is("/surveillances") && path !== "/surveillances/nouvelle" },
    { href: "/surveillances/nouvelle", label: "Nouvelle surveillance", icon: <Plus />, active: path === "/surveillances/nouvelle" },
    { href: "/alertes", label: "Alertes", icon: <Bell />, active: is("/alertes") },
    { href: "/historique", label: "Historique", icon: <History />, active: is("/historique") },
    { href: "/activite", label: "Activité de cet ordinateur", icon: <Activity />, active: is("/activite") },
  ];
  const secondary: NavItem[] = [{ href: "/parametres", label: "Paramètres", icon: <Settings />, active: is("/parametres") }];
  const detail = /^\/surveillances\/([0-9a-f-]{36})$/.exec(path)?.[1];

  let page: React.ReactNode;
  if (path === "/") page = <OverviewPage webBase={info.apiBase} snapshot={snapshot} />;
  else if (path === "/surveillances") page = <MonitorsPage webBase={info.apiBase} />;
  else if (path === "/surveillances/nouvelle") page = <NewMonitorPage webBase={info.apiBase} agent={agent} />;
  else if (detail) page = <MonitorDetailPage key={detail} id={detail} />;
  else if (path === "/alertes") page = <AlertsPage />;
  else if (path === "/historique") page = <HistoryPage />;
  else if (path === "/activite") page = <ActivityPage snapshot={snapshot} />;
  else if (path === "/parametres")
    page = <SettingsPage info={info} me={me} paused={paused} onPausedChange={onPausedChange} onConsentChange={onConsent} onUnlinked={onUnlinked} />;
  else page = <OverviewPage webBase={info.apiBase} snapshot={snapshot} />;

  return (
    <AppShell
      nav={nav}
      secondaryNav={secondary}
      renderLink={renderLink}
      homeHref="/"
      header={
        <div className="flex items-center gap-3">
          <span className="hidden items-center gap-2 text-sm text-muted-fg md:flex" aria-live="polite">
            <AgentDot phase={snapshot.phase} /> {PHASE_LABEL[snapshot.phase]}
          </span>
          <Button variant="secondary" size="sm" onClick={() => onPausedChange(!paused)} aria-pressed={paused}>
            {paused ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}
            {paused ? "Reprendre" : "Pause"}
          </Button>
        </div>
      }
      sidebarFooter={<p className="px-3 text-xs text-muted-fg">{me.user.email}</p>}
    >
      {snapshot.phase === "no_subscription" || (!snapshot.plan && !me.plan.id) ? (
        <Callout tone="info" className="mb-6" title="Aucun abonnement actif">
          <p>Vos surveillances sont en pause. Choisissez une formule pour démarrer votre essai gratuit de 3 jours.</p>
          <Button size="sm" className="mt-2 self-start" onClick={() => void native.openExternal(`${info.apiBase}/app/abonnement`)}>
            Choisir une formule
          </Button>
        </Callout>
      ) : snapshot.phase === "needs_consent" || snapshot.phase === "disabled" ? (
        <Callout tone="warning" className="mb-6" title="Aucun contrôle n'est effectué sur cet ordinateur">
          <p>Vos pages restent contrôlées par les serveurs Waverti.</p>
          <Button size="sm" className="mt-2 self-start" onClick={onConsent}>
            Activer les contrôles locaux
          </Button>
        </Callout>
      ) : null}
      {page}
    </AppShell>
  );
}
