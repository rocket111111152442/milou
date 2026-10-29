import { describe, expect, it, vi } from "vitest";
import { HOST_SPACING_MS, LocalAgent, type AgentDeps } from "../src/lib/agent";
import type { FetchedPage } from "../src/lib/native";

const PRODUCT_HTML = `<!doctype html><html><head><title>Casque X</title>
<script type="application/ld+json">{"@type":"Product","name":"Casque X","offers":{"@type":"Offer","price":"129.99","priceCurrency":"EUR","availability":"https://schema.org/InStock"}}</script>
</head><body><h1>Casque X</h1><p>129,99 €</p></body></html>`;

function page(url: string, body: string, status = 200): FetchedPage {
  return { url, finalUrl: url, status, contentType: "text/html", body, truncated: false, redirects: 0, durationMs: 5 };
}

function job(id: string, url: string) {
  return {
    jobId: id,
    claimToken: "6f1c2b8e-1d2c-4c55-9a1e-0c0b5c7d8e9f",
    leaseExpiresAt: new Date(Date.now() + 180_000).toISOString(),
    task: { id: `task-${id}`, name: `Tâche ${id}`, kind: "page" as const, url, cssSelector: null, renderMode: "auto" as const },
  };
}

interface Call {
  method: string;
  path: string;
  body?: unknown;
}

function setup(opts: {
  heartbeat?: Partial<{ consent: boolean; monitoringEnabled: boolean; pendingNotifications: number }>;
  jobs?: ReturnType<typeof job>[];
  robots?: string | null;
  fetchPage?: AgentDeps["fetchPage"];
  resultError?: { status: number; code: string };
  apiFails?: boolean;
}) {
  const calls: Call[] = [];
  let clock = 1_000_000;
  const slept: number[] = [];
  const notified: string[] = [];
  const status: string[] = [];
  let jobs = opts.jobs ?? [];
  const deps: AgentDeps = {
    api: (async (method: string, path: string, body?: unknown) => {
      calls.push({ method, path, body });
      if (opts.apiFails) throw Object.assign(new Error("Serveur Watchly injoignable."), { status: 0, code: "network" });
      if (path === "/api/agent/heartbeat")
        return {
          consent: true,
          monitoringEnabled: true,
          pendingNotifications: 0,
          plan: { id: "discovery", cloudRelay: false, pageIntervalMinutes: 1440 },
          ...opts.heartbeat,
        };
      if (path === "/api/agent/jobs/claim") {
        const out = jobs;
        jobs = [];
        return { jobs: out };
      }
      if (path.endsWith("/result")) {
        if (opts.resultError) throw Object.assign(new Error("refusé"), opts.resultError);
        return { outcome: "ok", triggered: false, summary: "Aucun changement" };
      }
      if (path === "/api/agent/notifications") return { notifications: [{ id: "n1", title: "Prix en baisse", body: "119 €", taskName: "Casque" }] };
      throw new Error(`appel inattendu ${path}`);
    }) as AgentDeps["api"],
    fetchPage: opts.fetchPage ?? (async (url) => page(url, PRODUCT_HTML)),
    fetchRobots: async (url) => {
      if (opts.robots === null) return page(url, "", 404);
      return { ...page(url, opts.robots ?? "User-agent: *\nAllow: /"), contentType: "text/plain" };
    },
    notify: (n) => void notified.push(n.title),
    reportStatus: (t) => void status.push(t),
    now: () => clock,
    sleep: async (ms) => {
      slept.push(ms);
      clock += ms;
    },
    appVersion: "0.1.0",
  };
  const agent = new LocalAgent(deps);
  return { agent, calls, slept, notified, status, advance: (ms: number) => (clock += ms) };
}

describe("agent local (application desktop)", () => {
  it("signal de vie, réservation, extraction locale puis envoi du résultat", async () => {
    const t = setup({ jobs: [job("j1", "https://boutique.example/casque")] });
    await t.agent.tick();
    expect(t.calls.map((c) => c.path)).toEqual(["/api/agent/heartbeat", "/api/agent/jobs/claim", "/api/agent/jobs/j1/result", "/api/agent/notifications"]);
    const hb = t.calls[0]!.body as { state: string; appVersion: string };
    expect(hb).toMatchObject({ state: "idle", appVersion: "0.1.0" });
    const result = t.calls[2]!.body as { claimToken: string; observation: { price: number; currency: string; availability: string; method: string } };
    expect(result.claimToken).toBe("6f1c2b8e-1d2c-4c55-9a1e-0c0b5c7d8e9f");
    expect(result.observation).toMatchObject({ price: 129.99, currency: "EUR", availability: "in_stock", method: "http" });
    expect(t.agent.snapshot().activity[0]).toMatchObject({ taskName: "Tâche j1", host: "boutique.example", outcome: "ok" });
    expect(t.agent.snapshot().phase).toBe("idle");
    expect(t.status).toContain("Contrôles locaux actifs");
  });

  it("ne réserve aucun contrôle sans accord explicite", async () => {
    const t = setup({ heartbeat: { consent: false }, jobs: [job("j1", "https://boutique.example/a")] });
    await t.agent.tick();
    expect(t.calls.map((c) => c.path)).toEqual(["/api/agent/heartbeat"]);
    expect(t.agent.snapshot().phase).toBe("needs_consent");
  });

  it("en pause : signale l'état « paused » et ne réserve rien", async () => {
    const t = setup({ jobs: [job("j1", "https://boutique.example/a")] });
    t.agent.setPaused(true);
    await t.agent.tick();
    expect(t.calls.map((c) => c.path)).toEqual(["/api/agent/heartbeat"]);
    expect((t.calls[0]!.body as { state: string }).state).toBe("paused");
  });

  it("respecte robots.txt : aucune requête vers une page interdite", async () => {
    const fetchPage = vi.fn(async (url: string) => page(url, PRODUCT_HTML));
    const t = setup({ jobs: [job("j1", "https://boutique.example/prive/casque")], robots: "User-agent: *\nDisallow: /prive/", fetchPage });
    await t.agent.tick();
    expect(fetchPage).not.toHaveBeenCalled();
    expect((t.calls[2]!.body as { error: { code: string } }).error.code).toBe("robots_disallowed");
  });

  it("robots.txt absent (404) : accès autorisé", async () => {
    const t = setup({ jobs: [job("j1", "https://boutique.example/casque")], robots: null });
    await t.agent.tick();
    expect((t.calls[2]!.body as { observation?: unknown }).observation).toBeDefined();
  });

  it("espace les requêtes vers un même site", async () => {
    const t = setup({ jobs: [job("j1", "https://boutique.example/a"), job("j2", "https://boutique.example/b")] });
    await t.agent.tick();
    expect(t.slept).toEqual([HOST_SPACING_MS]);
  });

  it("transmet les refus de sécurité du téléchargement (adresse privée)", async () => {
    const t = setup({
      jobs: [job("j1", "https://interne.example/admin")],
      fetchPage: async () => {
        throw { code: "blocked_address", message: "Adresse privée ou réservée refusée" };
      },
    });
    await t.agent.tick();
    expect((t.calls[2]!.body as { error: { code: string } }).error).toEqual({ code: "blocked_address", message: "Adresse privée ou réservée refusée" });
    expect(t.agent.snapshot().activity[0]!.outcome).toBe("error");
  });

  it("réservation expirée : le résultat refusé est indiqué sans plantage", async () => {
    const t = setup({ jobs: [job("j1", "https://boutique.example/a")], resultError: { status: 409, code: "stale_claim" } });
    await t.agent.tick();
    expect(t.agent.snapshot().activity[0]).toMatchObject({ outcome: "skipped", detail: "Délai dépassé : le contrôle a été réattribué." });
  });

  it("serveur injoignable : état hors ligne et nouvel essai différé", async () => {
    const t = setup({ apiFails: true });
    await t.agent.tick();
    expect(t.agent.snapshot().phase).toBe("offline");
    await t.agent.tick(); // pendant l'attente : aucun appel
    expect(t.calls).toHaveLength(1);
    t.advance(16_000);
    await t.agent.tick();
    expect(t.calls).toHaveLength(2);
  });

  it("affiche les notifications en attente sur le bureau", async () => {
    const t = setup({ heartbeat: { pendingNotifications: 1 } });
    await t.agent.tick();
    expect(t.notified).toEqual(["Prix en baisse"]);
  });

  it("deux réveils simultanés ne se chevauchent pas", async () => {
    const t = setup({ jobs: [job("j1", "https://boutique.example/a")] });
    await Promise.all([t.agent.tick(), t.agent.tick()]);
    expect(t.calls.filter((c) => c.path === "/api/agent/jobs/claim")).toHaveLength(1);
  });
});
