/**
 * Test de charge du moteur Business (lancé par `pnpm test:load`) :
 * - 30 clients Business × 3 points de contrôle = 90 points, contrôlés par 3 workers concurrents ;
 * - 40 tours complets = 3 600 contrôles HTTP réels contre des serveurs locaux
 *   (réponses normales, lentes, en erreur) ;
 * - vérifie : aucun contrôle en double par tour, incidents uniquement pour les points en panne,
 *   débit, latence, CPU et mémoire ; puis 6 scénarios navigateur concurrents sur un pool de 2.
 * Les mesures sont écrites dans docs/LOAD-TEST-RESULTS.md (machine de test, non extrapolées).
 */
import http from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { businessEndpoints, businessSites, eq, sql, subscriptions } from "@watchly/database";
import { createTestDatabase, createTestUser, type TestDatabase } from "@watchly/database/testing";
import { recomputeEntitlements } from "@watchly/billing";
import { checkEndpoint, claimDueEndpoints, createEndpoint, createSite, recordEndpointResult, runScenario } from "../src/business";
import { BrowserPool } from "../src/browser/pool";
import { writeLoadSection } from "./load-report";

const CLIENTS = 30;
const ENDPOINTS_PER_CLIENT = 3;
const ROUNDS = 40;
const WORKERS = 3;
const CONCURRENCY = 16;
const LOCAL = { allowLoopback: true, allowAnyPort: true };

let t: TestDatabase;
let server: http.Server;
let base = "";
let served = 0;
const report: string[] = [];

beforeAll(async () => {
  t = await createTestDatabase();
  server = http.createServer((req, res) => {
    served++;
    if (req.url?.startsWith("/panne")) return void res.writeHead(500).end("erreur");
    if (req.url?.startsWith("/lent")) return void setTimeout(() => res.writeHead(200, { "content-type": "text/html" }).end("<p>OK lent</p>"), 150);
    res.writeHead(200, { "content-type": "text/html" }).end("<!doctype html><title>Boutique</title><p>Bienvenue</p>");
  });
  server.maxConnections = 2000;
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});

afterAll(async () => {
  server?.close();
  await t?.drop();
  writeLoadSection("business", report);
});

function pct(sorted: number[], p: number) {
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))] ?? 0;
}

describe("charge — moteur Business", () => {
  it(`${CLIENTS} clients × ${ENDPOINTS_PER_CLIENT} points, ${ROUNDS} tours, ${WORKERS} workers concurrents`, async () => {
    const failing = new Set<string>();
    for (let c = 0; c < CLIENTS; c++) {
      const u = await createTestUser(t);
      await t.db.insert(subscriptions).values({
        userId: u.id,
        planId: "business",
        stripeSubscriptionId: `sub_load_${c}`,
        stripeCustomerId: `cus_load_${c}`,
        status: "active",
        currentPeriodEnd: new Date(Date.now() + 20 * 86_400_000),
      });
      await recomputeEntitlements(t.db, u.id);
      const site = await createSite(t.db, u.id, { name: `Client ${c}`, domain: `client-${c}.test` });
      await t.db.update(businessSites).set({ status: "verified" }).where(eq(businessSites.id, site.id));
      for (let e = 0; e < ENDPOINTS_PER_CLIENT; e++) {
        // 1 client sur 10 a un point en panne ; 1 point sur 3 est lent.
        const path = c % 10 === 0 && e === 0 ? "/panne" : e === 2 ? "/lent" : "/";
        const ep = await createEndpoint(t.db, u.id, site.id, { name: `P${e}`, url: `${base}${path}?c=${c}&e=${e}` }, LOCAL);
        if (path === "/panne") failing.add(ep.id);
      }
    }

    const latencies: number[] = [];
    const duplicates: number[] = [];
    let checks = 0;
    const cpu0 = process.cpuUsage();
    let peakRss = 0;
    const started = Date.now();
    let now = Date.now();
    for (let round = 0; round < ROUNDS; round++) {
      // Tous les points deviennent dus en même temps (pire cas : pic de charge synchronisé).
      await t.db.execute(sql`update business_endpoints set next_check_at = ${new Date(now).toISOString()}::timestamptz, lease_expires_at = null, lease_owner = null`);
      const seen = new Map<string, number>();
      await Promise.all(
        Array.from({ length: WORKERS }, async (_, w) => {
          const workerId = `load-w${w}`;
          for (;;) {
            const claimed = await claimDueEndpoints(t.db, { workerId, max: CONCURRENCY, now: new Date(now) });
            if (!claimed.length) break;
            await Promise.all(
              claimed.map(async (ep) => {
                seen.set(ep.id, (seen.get(ep.id) ?? 0) + 1);
                const r = await checkEndpoint(ep, LOCAL);
                latencies.push(r.responseMs);
                await recordEndpointResult(t.db, ep, workerId, r, new Date(now));
                checks++;
              }),
            );
          }
        }),
      );
      duplicates.push([...seen.values()].filter((v) => v > 1).length);
      // Les re-vérifications rapprochées des points en échec (20 s) sont incluses dans le tour suivant.
      now += 61_000;
      peakRss = Math.max(peakRss, process.memoryUsage().rss);
    }
    const elapsed = (Date.now() - started) / 1000;
    const cpu = process.cpuUsage(cpu0);
    latencies.sort((a, b) => a - b);

    const [{ n: checkRows } = { n: 0 }] = await t.db.execute<{ n: number }>(sql`select count(*)::int as n from business_checks`);
    const incidents = await t.db.execute<{ endpoint_id: string; status: string }>(sql`select endpoint_id, status from incidents`);
    const [{ n: endpointsTotal } = { n: 0 }] = await t.db.execute<{ n: number }>(sql`select count(*)::int as n from business_endpoints`);

    expect(endpointsTotal).toBe(CLIENTS * ENDPOINTS_PER_CLIENT);
    expect(checks).toBe(CLIENTS * ENDPOINTS_PER_CLIENT * ROUNDS);
    expect(checkRows).toBe(checks);
    expect(duplicates.every((d) => d === 0)).toBe(true);
    // Un incident unique et ouvert par point en panne, aucun pour les autres.
    expect(new Set(incidents.map((i) => i.endpoint_id))).toEqual(failing);
    expect(incidents.every((i) => i.status === "open")).toBe(true);
    const states = await t.db.select({ id: businessEndpoints.id, state: businessEndpoints.state }).from(businessEndpoints);
    for (const s of states) expect(failing.has(s.id) ? s.state === "down" : s.state === "up" || s.state === "degraded").toBe(true);

    report.push(
      "## Moteur Business — contrôles HTTP",
      "",
      `Mesuré le ${new Date().toISOString()} (${process.platform}, Node ${process.version}).`,
      "",
      `- Configuration : ${CLIENTS} clients × ${ENDPOINTS_PER_CLIENT} points de contrôle = ${endpointsTotal} points, ${WORKERS} workers concurrents (concurrence ${CONCURRENCY} chacun), ${ROUNDS} tours où tous les points sont dus simultanément.`,
      `- Contrôles HTTP réels effectués : ${checks} (requêtes reçues par le serveur de test : ${served}).`,
      `- Durée : ${elapsed.toFixed(1)} s, soit ${(checks / elapsed).toFixed(0)} contrôles/s (incluant l'écriture en base de chaque résultat).`,
      `- Latence HTTP : médiane ${pct(latencies, 50)} ms, p95 ${pct(latencies, 95)} ms, max ${latencies.at(-1)} ms (dont 1/3 de points volontairement lents à ~150 ms).`,
      `- Contrôles en double dans un même tour : ${duplicates.reduce((a, b) => a + b, 0)} (attendu : 0).`,
      `- Incidents : ${incidents.length} ouverts pour ${failing.size} points en panne (attendu : un par point en panne, aucun faux positif).`,
      `- CPU du processus de test : ${((cpu.user + cpu.system) / 1e6).toFixed(1)} s ; mémoire résidente maximale : ${(peakRss / 1024 / 1024).toFixed(0)} Mo.`,
      `- Besoin réel à 30 clients Business (90 points toutes les 60 s) : 1,5 contrôle/s, soit ${((1.5 / (checks / elapsed)) * 100).toFixed(1)} % du débit mesuré ici.`,
      "",
    );
  });

  it("scénarios navigateur concurrents : 6 exécutions sur un pool limité à 2", async () => {
    const pool = new BrowserPool({ maxConcurrency: 2, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ?? "/opt/pw-browsers/chromium", egress: LOCAL });
    let maxActive = 0;
    const timer = setInterval(() => (maxActive = Math.max(maxActive, pool.load.active)), 20);
    const rss0 = process.memoryUsage().rss;
    const started = Date.now();
    const runs = await Promise.all(
      Array.from({ length: 6 }, () => runScenario(pool, { startUrl: `${base}/`, domain: "client.test", steps: [{ action: "expect_text", text: "Bienvenue" }] }, LOCAL)),
    );
    const elapsed = (Date.now() - started) / 1000;
    clearInterval(timer);
    await pool.close();
    expect(runs.every((r) => r.status === "passed")).toBe(true);
    expect(maxActive).toBeLessThanOrEqual(2);
    const durations = runs.map((r) => r.durationMs).sort((a, b) => a - b);
    report.push(
      "## Scénarios navigateur",
      "",
      `- 6 scénarios lancés simultanément, pool limité à 2 navigateurs actifs (maximum observé : ${maxActive}).`,
      `- Durée totale : ${elapsed.toFixed(1)} s ; durée par scénario : médiane ${pct(durations, 50)} ms, max ${durations.at(-1)} ms.`,
      `- Mémoire résidente du processus de test (hors processus Chromium) : +${((process.memoryUsage().rss - rss0) / 1024 / 1024).toFixed(0)} Mo.`,
      `- Besoin réel à 30 clients Business (1 scénario toutes les 2 h chacun) : 15 scénarios/heure.`,
      "",
    );
  });
});
