/**
 * Scénarios réels du moteur A sur des pages que nous contrôlons (serveur HTTP local) :
 * chaîne complète création → file → contrôle HTTP réel → extraction → comparaison → résultat → alerte.
 * Aucun site tiers n'est contacté.
 */
import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq, monitoringResults, notifications, sql, subscriptions } from "@waverti/database";
import { createTestDatabase, createTestUser, type TestDatabase } from "@waverti/database/testing";
import { recomputeEntitlements } from "@waverti/billing";
import type { PageCondition } from "@waverti/types";
import { claimCloudJobs, createMonitor, enqueueImmediate, HostPoliteness, RobotsCache, runPageCheck, submitResult } from "../src";

let t: TestDatabase;
let server: Server;
let base = "";
/** État de la boutique de test, modifié par chaque scénario. */
const shop = { price: "129,99", stock: true, text: "Livraison offerte dès 50 €", status: 200, delayMs: 0 };

function page(): string {
  const availability = shop.stock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock";
  return `<!doctype html><html><head><title>Casque</title>
    <script type="application/ld+json">{"@type":"Product","name":"Casque","offers":{"@type":"Offer","price":"${shop.price.replace(",", ".")}","priceCurrency":"EUR","availability":"${availability}"}}</script>
    </head><body><h1>Casque</h1><p class="prix">${shop.price} €</p><p>${shop.stock ? "En stock" : "Rupture de stock"}</p>
    <p>${shop.text}</p><p>${"Description détaillée du produit. ".repeat(20)}</p></body></html>`;
}

beforeAll(async () => {
  t = await createTestDatabase();
  server = createServer((req, res) => {
    if (req.url === "/robots.txt") return void res.writeHead(404).end();
    setTimeout(() => {
      if (shop.status !== 200) return void res.writeHead(shop.status, { "content-type": "text/plain" }).end("indisponible");
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end(page());
    }, shop.delayMs);
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});
afterAll(async () => {
  server?.close();
  await t?.drop();
});

const fetchOptions = { allowLoopback: true, allowAnyPort: true };
const robots = new RobotsCache(fetchOptions);

async function subscriber() {
  const u = await createTestUser(t);
  await t.db.insert(subscriptions).values({ userId: u.id, planId: "pro", stripeSubscriptionId: `sub_${u.id}`, stripeCustomerId: `cus_${u.id}`, status: "active", currentPeriodEnd: new Date(Date.now() + 20 * 86_400_000) });
  await recomputeEntitlements(t.db, u.id);
  return u;
}

async function monitor(userId: string, path: string, condition: PageCondition) {
  return createMonitor(
    t.db,
    userId,
    { kind: "page", name: `Test ${condition.type}`, url: `${base}${path}`, renderMode: "http", condition, executionMode: "cloud_only", notify: { inapp: true, email: false, desktop: false } },
    new Date(),
    { allowLoopback: true, allowAnyPort: true },
  );
}

/** Un contrôle réel, exactement comme le worker : file → réservation → HTTP → résultat. */
async function check(taskId: string, userId: string) {
  await t.db.execute(sql`delete from page_cache`);
  await t.db.execute(sql`delete from monitoring_jobs where task_id = ${taskId} and status in ('pending', 'claimed')`);
  await enqueueImmediate(t.db, { taskId, userId, manual: true });
  const [claim] = (await claimCloudJobs(t.db, { workerId: "scenario", max: 10, kinds: ["page"] })).filter((c) => c.taskId === taskId);
  expect(claim, "aucun travail réservé").toBeDefined();
  const run = await runPageCheck({ db: t.db, robots, politeness: new HostPoliteness(0), fetchOptions }, { url: `${base}${(await target(taskId))}`, cssSelector: null, renderMode: "http" });
  return submitResult(t.db, { jobId: claim!.jobId, claimToken: claim!.claimToken, executor: "cloud", durationMs: run.durationMs, observation: run.observation, error: run.error, fromCache: run.fromCache });
}
const paths = new Map<string, string>();
async function target(taskId: string) {
  return paths.get(taskId)!;
}
async function alerts(taskId: string) {
  return t.db.select({ type: notifications.type, title: notifications.title }).from(notifications).where(eq(notifications.taskId, taskId));
}

describe("moteur A — scénarios sur pages contrôlées", () => {
  it("prix : baisse sous le seuil → une alerte ; hausse puis nouvelle baisse → une nouvelle alerte ; historique complet", async () => {
    const u = await subscriber();
    Object.assign(shop, { price: "129,99", stock: true, status: 200, delayMs: 0 });
    const m = await monitor(u.id, "/casque", { type: "price_below", threshold: 100, currency: "EUR" });
    paths.set(m.id, "/casque");
    expect((await check(m.id, u.id)).triggered).toBe(false);
    shop.price = "89,90";
    expect((await check(m.id, u.id)).triggered).toBe(true);
    // Toujours sous le seuil : pas de répétition.
    shop.price = "85,00";
    expect((await check(m.id, u.id)).triggered).toBe(false);
    // Remonte au-dessus puis redescend : nouvelle alerte.
    shop.price = "119,00";
    expect((await check(m.id, u.id)).triggered).toBe(false);
    shop.price = "95,00";
    expect((await check(m.id, u.id)).triggered).toBe(true);
    expect((await alerts(m.id)).filter((a) => a.type === "price")).toHaveLength(2);
    const history = await t.db.select({ obs: monitoringResults.observation }).from(monitoringResults).where(eq(monitoringResults.taskId, m.id)).orderBy(monitoringResults.checkedAt);
    expect(history.map((h) => (h.obs as { price: number }).price)).toEqual([129.99, 89.9, 85, 119, 95]);
  });

  it("baisse de prix d'au moins 10 % : une hausse n'alerte jamais, une petite baisse non plus", async () => {
    const u = await subscriber();
    Object.assign(shop, { price: "200,00", stock: true, status: 200 });
    const m = await monitor(u.id, "/casque-pct", { type: "price_drop", minPercent: 10 });
    paths.set(m.id, "/casque-pct");
    await check(m.id, u.id);
    shop.price = "240,00";
    expect((await check(m.id, u.id)).triggered).toBe(false);
    shop.price = "230,00"; // -4 %
    expect((await check(m.id, u.id)).triggered).toBe(false);
    shop.price = "190,00"; // -17 %
    expect((await check(m.id, u.id)).triggered).toBe(true);
  });

  it("retour en stock : alerte uniquement au passage rupture → disponible", async () => {
    const u = await subscriber();
    Object.assign(shop, { price: "129,99", stock: false, status: 200 });
    const m = await monitor(u.id, "/casque-stock", { type: "back_in_stock" });
    paths.set(m.id, "/casque-stock");
    expect((await check(m.id, u.id)).triggered).toBe(false);
    expect((await check(m.id, u.id)).triggered).toBe(false);
    shop.stock = true;
    expect((await check(m.id, u.id)).triggered).toBe(true);
    expect((await check(m.id, u.id)).triggered).toBe(false);
    expect(await alerts(m.id)).toHaveLength(1);
  });

  it("apparition d'un texte et modification significative du contenu", async () => {
    const u = await subscriber();
    Object.assign(shop, { price: "129,99", stock: true, status: 200, text: "Livraison offerte dès 50 €" });
    const appears = await monitor(u.id, "/casque-texte", { type: "text_appears", text: "promotion" });
    paths.set(appears.id, "/casque-texte");
    const changed = await monitor(u.id, "/casque-contenu", { type: "page_changed", sensitivity: "significant" });
    paths.set(changed.id, "/casque-contenu");
    expect((await check(appears.id, u.id)).triggered).toBe(false);
    expect((await check(changed.id, u.id)).triggered).toBe(false);
    shop.text = "Grande PROMOTION de printemps : -30 % sur toute la gamme audio, offre valable jusqu'à dimanche. ".repeat(4);
    expect((await check(appears.id, u.id)).triggered).toBe(true);
    const r = await check(changed.id, u.id);
    expect(["changed", "triggered"]).toContain(r.outcome);
    expect(r.triggered).toBe(true);
  });

  it("erreurs HTTP et site temporairement indisponible : erreur enregistrée, aucune fausse alerte, reprise normale", async () => {
    const u = await subscriber();
    Object.assign(shop, { price: "129,99", stock: true, status: 200, delayMs: 0, text: "Livraison offerte dès 50 €" });
    const m = await monitor(u.id, "/casque-panne", { type: "price_below", threshold: 100, currency: "EUR" });
    paths.set(m.id, "/casque-panne");
    await check(m.id, u.id);
    shop.status = 503;
    const down = await check(m.id, u.id);
    expect(down.outcome).toBe("error");
    expect(down.triggered).toBe(false);
    shop.status = 404;
    expect((await check(m.id, u.id)).outcome).toBe("error");
    // Site lent (4 s, sous le délai de 20 s du contrôleur) : contrôle réussi, ce n'est pas une panne.
    shop.status = 200;
    shop.delayMs = 4000;
    expect((await check(m.id, u.id)).outcome).toBe("ok");
    shop.delayMs = 0;
    expect((await check(m.id, u.id)).outcome).toBe("ok");
    expect(await alerts(m.id)).toEqual([]);
    const errors = await t.db
      .select({ code: monitoringResults.errorCode })
      .from(monitoringResults)
      .where(and(eq(monitoringResults.taskId, m.id), eq(monitoringResults.outcome, "error")));
    expect(errors.length).toBe(2);
    expect(errors.every((e) => typeof e.code === "string" && e.code.length > 0)).toBe(true);
  }, 30_000);
});
