/**
 * Agent local : exécute sur CET ordinateur les contrôles de pages de l'utilisateur relié,
 * et uniquement les siens (le serveur ne lui confie que ses propres tâches).
 *
 * Le processus Rust réveille l'agent toutes les 20 s (même fenêtre fermée). À chaque réveil :
 * signal de vie (60 s), réservation d'au plus 2 contrôles, robots.txt, espacement par site,
 * téléchargement sécurisé (Rust), extraction (même code que le serveur), envoi du résultat.
 */
import { extractPage } from "@watchly/monitoring/extract";
import { isAllowedByRules, parseRobots, type RobotsPolicy } from "@watchly/monitoring/robots-rules";
import type { AgentJob, NotificationView, PageObservation } from "@watchly/types";
import type { FetchedPage } from "./native";

export const HEARTBEAT_MS = 60_000;
export const HOST_SPACING_MS = 5_000;
export const MAX_PARALLEL = 2;

export type AgentPhase = "starting" | "needs_consent" | "disabled" | "paused" | "idle" | "running" | "offline";

export interface ActivityEntry {
  at: number;
  taskName: string;
  host: string;
  outcome: "ok" | "triggered" | "error" | "skipped";
  detail: string;
}

export interface AgentSnapshot {
  phase: AgentPhase;
  running: number;
  lastContactAt: number | null;
  lastError: string | null;
  plan: { id: string; cloudRelay: boolean; pageIntervalMinutes: number } | null;
  activity: ActivityEntry[];
}

export interface AgentDeps {
  api: <T>(method: "GET" | "POST", path: string, body?: unknown) => Promise<T>;
  fetchPage: (url: string) => Promise<FetchedPage>;
  fetchRobots: (url: string) => Promise<FetchedPage>;
  notify: (n: NotificationView) => Promise<void> | void;
  reportStatus: (text: string) => void;
  now: () => number;
  sleep: (ms: number) => Promise<void>;
  appVersion: string;
}

interface HeartbeatResponse {
  monitoringEnabled: boolean;
  consent: boolean;
  plan: { id: string; cloudRelay: boolean; pageIntervalMinutes: number };
  pendingNotifications: number;
}

interface ResultResponse {
  outcome: string;
  triggered: boolean;
  summary: string | null;
}

function errorInfo(e: unknown): { code: string; message: string } {
  if (typeof e === "object" && e !== null && "code" in e && "message" in e) {
    return { code: String((e as { code: unknown }).code).slice(0, 60), message: String((e as { message: unknown }).message).slice(0, 500) };
  }
  return { code: "check_failed", message: "Le contrôle a échoué." };
}

const STATUS_TEXT: Record<AgentPhase, string> = {
  starting: "Démarrage…",
  needs_consent: "En attente de votre accord",
  disabled: "Contrôles locaux désactivés",
  paused: "Contrôles locaux en pause",
  idle: "Contrôles locaux actifs",
  running: "Contrôle en cours…",
  offline: "Hors ligne — nouvel essai automatique",
};

export class LocalAgent {
  private busy = false;
  private paused = false;
  private lastHeartbeat = 0;
  private robots = new Map<string, RobotsPolicy>();
  private hostLast = new Map<string, number>();
  private listeners = new Set<(s: AgentSnapshot) => void>();
  private failures = 0;
  private nextAttemptAt = 0;
  private snap: AgentSnapshot = { phase: "starting", running: 0, lastContactAt: null, lastError: null, plan: null, activity: [] };

  constructor(private readonly deps: AgentDeps) {}

  snapshot(): AgentSnapshot {
    return this.snap;
  }

  subscribe(fn: (s: AgentSnapshot) => void): () => void {
    this.listeners.add(fn);
    fn(this.snap);
    return () => this.listeners.delete(fn);
  }

  private set(patch: Partial<AgentSnapshot>) {
    const prevPhase = this.snap.phase;
    this.snap = { ...this.snap, ...patch };
    if (patch.phase && patch.phase !== prevPhase) this.deps.reportStatus(STATUS_TEXT[patch.phase]);
    for (const l of this.listeners) l(this.snap);
  }

  private log(entry: Omit<ActivityEntry, "at">) {
    this.set({ activity: [{ ...entry, at: this.deps.now() }, ...this.snap.activity].slice(0, 100) });
  }

  setPaused(paused: boolean) {
    this.paused = paused;
    this.lastHeartbeat = 0; // l'état est transmis au prochain réveil
    this.set({ phase: paused ? "paused" : this.snap.phase === "paused" ? "idle" : this.snap.phase });
  }

  /** Un réveil. Ne se chevauche jamais avec le précédent. */
  async tick(): Promise<void> {
    if (this.busy) return;
    if (this.deps.now() < this.nextAttemptAt) return;
    this.busy = true;
    try {
      const now = this.deps.now();
      if (now - this.lastHeartbeat >= HEARTBEAT_MS) {
        const hb = await this.deps.api<HeartbeatResponse>("POST", "/api/agent/heartbeat", {
          state: this.paused ? "paused" : this.snap.running > 0 ? "running" : "idle",
          runningJobs: this.snap.running,
          appVersion: this.deps.appVersion,
        });
        this.lastHeartbeat = now;
        this.set({ lastContactAt: now, plan: hb.plan, lastError: null });
        if (!hb.consent) this.set({ phase: "needs_consent" });
        else if (!hb.monitoringEnabled) this.set({ phase: "disabled" });
        else this.set({ phase: this.paused ? "paused" : "idle" });
        if (hb.pendingNotifications > 0) await this.deliverNotifications();
      }
      this.failures = 0;
      if (this.paused || this.snap.phase === "needs_consent" || this.snap.phase === "disabled") return;

      const { jobs } = await this.deps.api<{ jobs: AgentJob[] }>("POST", "/api/agent/jobs/claim", { max: MAX_PARALLEL });
      if (jobs.length) {
        this.set({ phase: "running", running: jobs.length });
        await Promise.all(jobs.map((j) => this.runJob(j)));
        this.set({ phase: this.paused ? "paused" : "idle", running: 0 });
        await this.deliverNotifications();
      }
    } catch (e) {
      const status = (e as { status?: number }).status;
      if (status === 403 && (e as { code?: string }).code === "consent_required") {
        this.set({ phase: "needs_consent" });
      } else {
        // Réseau ou serveur indisponible : nouvel essai avec attente croissante (max 5 min).
        this.failures += 1;
        this.nextAttemptAt = this.deps.now() + Math.min(300_000, 15_000 * 2 ** Math.min(this.failures - 1, 5));
        this.set({ phase: "offline", running: 0, lastError: (e as Error).message ?? "Serveur injoignable" });
      }
    } finally {
      this.busy = false;
    }
  }

  async deliverNotifications() {
    const { notifications } = await this.deps.api<{ notifications: NotificationView[] }>("GET", "/api/agent/notifications");
    for (const n of notifications) await this.deps.notify(n);
  }

  async robotsAllowed(url: URL): Promise<boolean> {
    if (url.pathname === "/robots.txt") return true;
    const cached = this.robots.get(url.origin);
    let policy = cached && this.deps.now() - cached.fetchedAt < cached.ttlMs ? cached : null;
    if (!policy) {
      const at = this.deps.now();
      try {
        const res = await this.deps.fetchRobots(`${url.origin}/robots.txt`);
        if (res.status >= 200 && res.status < 300) policy = { mode: "rules", rules: parseRobots(res.body), fetchedAt: at, ttlMs: 24 * 3_600_000 };
        else if (res.status >= 400 && res.status < 500) policy = { mode: "none", rules: [], fetchedAt: at, ttlMs: 24 * 3_600_000 };
        else policy = { mode: "full", rules: [], fetchedAt: at, ttlMs: 3_600_000 };
      } catch {
        // RFC 9309 : robots.txt injoignable => interdiction temporaire.
        policy = { mode: "full", rules: [], fetchedAt: at, ttlMs: 3_600_000 };
      }
      this.robots.set(url.origin, policy);
    }
    if (policy.mode === "none") return true;
    if (policy.mode === "full") return false;
    return isAllowedByRules(policy.rules, url.pathname + url.search);
  }

  /** Espace d'au moins 5 s deux requêtes vers un même site depuis cet ordinateur. */
  private async politeWait(host: string) {
    const last = this.hostLast.get(host);
    const wait = last === undefined ? 0 : last + HOST_SPACING_MS - this.deps.now();
    this.hostLast.set(host, Math.max(this.deps.now(), (last ?? 0) + HOST_SPACING_MS));
    if (wait > 0) await this.deps.sleep(wait);
  }

  async runJob(job: AgentJob): Promise<void> {
    const started = this.deps.now();
    let host = "";
    let observation: PageObservation | undefined;
    let error: { code: string; message: string } | undefined;
    try {
      const url = new URL(job.task.url);
      host = url.hostname;
      if (!(await this.robotsAllowed(url))) {
        error = { code: "robots_disallowed", message: "Le site interdit l'accès automatisé à cette page (robots.txt)." };
      } else {
        await this.politeWait(host);
        const page = await this.deps.fetchPage(job.task.url);
        observation = extractPage({
          html: page.body,
          url: job.task.url,
          finalUrl: page.finalUrl,
          httpStatus: page.status,
          cssSelector: job.task.cssSelector,
          method: "http",
        });
      }
    } catch (e) {
      error = errorInfo(e);
    }
    const durationMs = Math.max(0, Math.min(600_000, this.deps.now() - started));
    try {
      const res = await this.deps.api<ResultResponse>("POST", `/api/agent/jobs/${job.jobId}/result`, {
        claimToken: job.claimToken,
        durationMs,
        ...(observation ? { observation } : { error }),
      });
      this.log({
        taskName: job.task.name,
        host,
        outcome: error ? "error" : res.triggered ? "triggered" : "ok",
        detail: error ? error.message : (res.summary ?? "Contrôle effectué"),
      });
    } catch (e) {
      const code = (e as { code?: string }).code;
      this.log({
        taskName: job.task.name,
        host,
        outcome: "skipped",
        detail: code === "stale_claim" ? "Délai dépassé : le contrôle a été réattribué." : "Résultat non transmis (serveur injoignable).",
      });
    }
  }
}
