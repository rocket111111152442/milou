/**
 * Test de charge de la file hybride (moteur A, `pnpm test:load`) : 300 comptes Pro × 5 pages
 * = 1 500 surveillances planifiées en même temps, traitées par 4 workers « cloud » concurrents
 * via la vraie chaîne : planification -> réservation -> robots.txt -> HTTP -> extraction ->
 * résultat. Les sites sont 50 boutiques locales distinctes (noms résolus vers 127.0.0.1).
 */
import http from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { monitoringSchedules, sql, subscriptions } from "@watchly/database";
import { createTestDatabase, createTestUser, type TestDatabase } from "@watchly/database/testing";
import { recomputeEntitlements } from "@watchly/billing";
import { HostPoliteness } from "../src/net/politeness";
import { RobotsCache } from "../src/net/robots";
import { claimCloudJobs, scheduleDueTasks } from "../src/queue";
import { submitResult } from "../src/results";
import { runPageCheck } from "../src/runner";
import { createMonitor } from "../src/service";
import { writeLoadSection } from "./load-report";

const USERS = 300;
const PER_USER = 5;
const SHOPS = 50;
const WORKERS = 4;
const CONCURRENCY = 8;

let t: TestDatabase;
let server: http.Server;
let port = 0;
let served = 0;

beforeAll(async () => {
  t = await createTestDatabase();
  server = http.createServer((req, res) => {
    served++;
    if (req.url === "/robots.txt") return void res.writeHead(404).end();
    const price = (100 + (served % 50)).toFixed(2);
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end(
      `<title>Produit</title><script type="application/ld+json">{"@type":"Product","offers":{"@type":"Offer","price":"${price}","priceCurrency":"EUR","availability":"https://schema.org/InStock"}}</script>`,
    );
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  port = (server.address() as { port: number }).port;
}, 300_000);

afterAll(async () => {
  server?.close();
  await t?.drop();
});

describe("charge — file des surveillances de pages", () => {
  it(`${USERS * PER_USER} surveillances dues simultanément, ${WORKERS} workers`, async () => {
    const fetchOptions = { allowLoopback: true, allowAnyPort: true, resolver: async () => [{ address: "127.0.0.1", family: 4 }] };
    for (let u = 0; u < USERS; u++) {
      const user = await createTestUser(t);
      await t.db.insert(subscriptions).values({
        userId: user.id,
        planId: "pro",
        stripeSubscriptionId: `sub_pl_${u}`,
        stripeCustomerId: `cus_pl_${u}`,
        status: "active",
        currentPeriodEnd: new Date(Date.now() + 20 * 86_400_000),
      });
      await recomputeEntitlements(t.db, user.id);
      for (let m = 0; m < PER_USER; m++) {
        await createMonitor(
          t.db,
          user.id,
          {
            kind: "page",
            name: `P${m}`,
            url: `http://boutique-${(u * PER_USER + m) % SHOPS}.load.test:${port}/produit-${u}-${m}`,
            renderMode: "http",
            condition: { type: "price_below", threshold: 50, currency: "EUR" },
            executionMode: "cloud_only",
            notify: { inapp: true, email: false, desktop: false },
          },
          new Date(),
          fetchOptions,
        );
      }
    }
    // Les exécutions initiales créées à la création sont annulées : on mesure une planification de masse.
    await t.db.execute(sql`update monitoring_jobs set status = 'canceled', finished_at = now() where status = 'pending'`);
    await t.db.update(monitoringSchedules).set({ nextRunAt: new Date(Date.now() - 1000) });

    const started = Date.now();
    const cpu0 = process.cpuUsage();
    const scheduled = await scheduleDueTasks(t.db, { limit: 5000 });
    const scheduleMs = Date.now() - started;
    expect(scheduled).toHaveLength(USERS * PER_USER);

    const robots = new RobotsCache(fetchOptions);
    // Espacement réel par site (1 s ici au lieu de 5 s, pour tenir dans la durée du test).
    const politeness = new HostPoliteness(1000, 120_000);
    let processed = 0;
    let peakRss = 0;
    await Promise.all(
      Array.from({ length: WORKERS }, async (_, w) => {
        for (;;) {
          const claims = await claimCloudJobs(t.db, { workerId: `pl-${w}`, max: CONCURRENCY, kinds: ["page"] });
          if (!claims.length) break;
          await Promise.all(
            claims.map(async (c) => {
              const [target] = await t.db.execute<{ url: string }>(sql`select url from monitoring_targets where task_id = ${c.taskId}`);
              const run = await runPageCheck({ db: t.db, robots, politeness, fetchOptions }, { url: target!.url, cssSelector: null, renderMode: "http" });
              await submitResult(t.db, { jobId: c.jobId, claimToken: c.claimToken, executor: "cloud", durationMs: run.durationMs, observation: run.observation, error: run.error });
              processed++;
            }),
          );
          peakRss = Math.max(peakRss, process.memoryUsage().rss);
        }
      }),
    );
    const elapsed = (Date.now() - started) / 1000;
    const cpu = process.cpuUsage(cpu0);
    const [res] = await t.db.execute<{ total: number; errors: number; dup: number }>(sql`
      select count(*)::int as total, count(*) filter (where outcome = 'error')::int as errors,
        (select count(*)::int from (select task_id from monitoring_results group by task_id having count(*) > 1) d) as dup
      from monitoring_results`);
    expect(processed).toBe(USERS * PER_USER);
    expect(res).toEqual({ total: USERS * PER_USER, errors: 0, dup: 0 });

    writeLoadSection(
      "pages",
      [
        "## Moteur A — file hybride des surveillances de pages",
        "",
        `Mesuré le ${new Date().toISOString()} (${process.platform}, Node ${process.version}).`,
        "",
        `- ${USERS} comptes Pro × ${PER_USER} pages = ${USERS * PER_USER} surveillances dues au même instant, ${SHOPS} sites distincts, ${WORKERS} workers « serveur » (concurrence ${CONCURRENCY}).`,
        `- Planification de toutes les tâches : ${scheduleMs} ms.`,
        `- Traitement complet (réservation, robots.txt, HTTP, extraction, résultat) : ${elapsed.toFixed(1)} s, soit ${(processed / elapsed).toFixed(0)} contrôles/s, limité volontairement par l'espacement d'1 s entre deux requêtes vers un même site.`,
        `- Résultats : ${res!.total} enregistrés, ${res!.errors} erreurs, ${res!.dup} tâche contrôlée deux fois ; requêtes HTTP reçues par les sites : ${served} (robots.txt inclus, page_cache mutualisé).`,
        `- CPU du processus de test : ${((cpu.user + cpu.system) / 1e6).toFixed(1)} s ; mémoire résidente maximale : ${(peakRss / 1024 / 1024).toFixed(0)} Mo.`,
      ],
    );
  }, 600_000);
});
