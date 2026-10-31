/**
 * Règles personnalisées de bout en bout sur des pages et documents CONTRÔLÉS (serveur HTTP local) :
 * création (validation serveur, quotas) → file → contrôle HTTP réel → extraction → règle → mémoire → alerte.
 * Aucun site tiers n'est contacté.
 */
import { createServer, type Server } from "node:http";
import { deflateSync } from "node:zlib";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, monitoringResults, monitoringSchedules, monitoringTasks, notifications, sql, subscriptions } from "@waverti/database";
import { createTestDatabase, createTestUser, type TestDatabase } from "@waverti/database/testing";
import { QuotaError, recomputeEntitlements } from "@waverti/billing";
type PageConditionInput = Record<string, unknown>;
import { claimCloudJobs, createMonitor, enqueueImmediate, HostPoliteness, MonitorError, RobotsCache, runPageCheck, submitResult } from "../src";

let t: TestDatabase;
let server: Server;
let base = "";
const site = {
  catalog: ["Alpha", "Bravo", "Charlie"],
  price: "249,00",
  stock: true,
  pdfText: "Resultats provisoires du concours.",
  docs: [["Règlement", "/reglement.pdf"]] as Array<[string, string]>,
  status: 200,
  hang: false,
};

function pdf(text: string): Buffer {
  const c = deflateSync(Buffer.from(`BT /F1 12 Tf 72 712 Td (${text}) Tj ET`, "latin1"));
  return Buffer.concat([Buffer.from(`%PDF-1.4\n1 0 obj\n<< /Length ${c.length} /Filter /FlateDecode >>\nstream\n`, "latin1"), c, Buffer.from("\nendstream\nendobj\n%%EOF")]);
}

beforeAll(async () => {
  t = await createTestDatabase();
  server = createServer((req, res) => {
    if (req.url === "/robots.txt") return void res.writeHead(404).end();
    if (site.hang && req.url === "/statut") return; // aucune réponse : délai dépassé
    if (site.status !== 200 && req.url === "/statut") return void res.writeHead(site.status).end("indisponible");
    if (req.url === "/resultats.pdf") return void res.writeHead(200, { "content-type": "application/pdf" }).end(pdf(site.pdfText));
    const body =
      req.url === "/catalogue"
        ? `<main><h1>Catalogue</h1><ul>${site.catalog.map((n) => `<li class="product-card"><a href="/p/${n}"><h3>${n}</h3></a><span>99,00 €</span></li>`).join("")}</ul></main><aside class="related"><a href="/p/${Date.now()}">Suggestion</a></aside>`
        : req.url === "/produit"
          ? `<main><h1>Casque</h1><p class="price">${site.price} €</p><p>${site.stock ? "En stock" : "Rupture de stock"}</p></main>`
          : req.url === "/documents"
            ? `<main><h1>Publications</h1><ul>${site.docs.map(([tt, h]) => `<li><a href="${h}">${tt}</a></li>`).join("")}</ul></main>`
            : `<main><p>Service opérationnel</p></main>`;
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end(`<!doctype html><html><head><title>Test</title></head><body>${body}<footer>${new Date().toISOString()}</footer></body></html>`);
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});
afterAll(async () => {
  server?.close();
  await t?.drop();
});

const fetchOptions = { allowLoopback: true, allowAnyPort: true, timeoutMs: 1500 };
const robots = new RobotsCache(fetchOptions);
const urlPolicy = { allowLoopback: true, allowAnyPort: true };

async function subscriber(planId = "pro") {
  const u = await createTestUser(t);
  await t.db.insert(subscriptions).values({ userId: u.id, planId, stripeSubscriptionId: `sub_${u.id}`, stripeCustomerId: `cus_${u.id}`, status: "active", currentPeriodEnd: new Date(Date.now() + 20 * 86_400_000) });
  await recomputeEntitlements(t.db, u.id);
  return u;
}

const paths = new Map<string, string>();
async function monitor(userId: string, path: string, condition: PageConditionInput, extra: { cssSelector?: string; intervalMinutes?: number } = {}) {
  const m = await createMonitor(
    t.db,
    userId,
    { kind: "page", name: `Règle ${path}`, url: `${base}${path}`, renderMode: "http", condition: condition as never, executionMode: "cloud_only", notify: { inapp: true, email: false, desktop: false }, ...extra },
    new Date(),
    urlPolicy,
  );
  paths.set(m.id, path);
  return m;
}

async function check(taskId: string, userId: string) {
  await t.db.execute(sql`delete from page_cache`);
  await t.db.execute(sql`delete from monitoring_jobs where task_id = ${taskId} and status in ('pending', 'claimed')`);
  await enqueueImmediate(t.db, { taskId, userId, manual: true });
  const [claim] = (await claimCloudJobs(t.db, { workerId: "rules", max: 10, kinds: ["page"] })).filter((c) => c.taskId === taskId);
  expect(claim).toBeDefined();
  const run = await runPageCheck({ db: t.db, robots, politeness: new HostPoliteness(0), fetchOptions }, { url: `${base}${paths.get(taskId)}`, cssSelector: null, renderMode: "http" });
  return submitResult(t.db, { jobId: claim!.jobId, claimToken: claim!.claimToken, executor: "cloud", durationMs: run.durationMs, observation: run.observation, error: run.error, fromCache: run.fromCache });
}
const alerts = (taskId: string) => t.db.select({ title: notifications.title, body: notifications.body }).from(notifications).where(eq(notifications.taskId, taskId));

describe("règles personnalisées (contrôles HTTP réels sur pages contrôlées)", () => {
  it("nouveau produit dans un catalogue : mémoire persistée, aucune alerte répétée ni pour un retour", async () => {
    const u = await subscriber();
    const m = await monitor(u.id, "/catalogue", { type: "rule", category: "product", conditions: [{ type: "item_added" }] });
    expect((await check(m.id, u.id)).triggered).toBe(false);
    site.catalog = ["Alpha", "Bravo", "Charlie", "Delta"];
    expect((await check(m.id, u.id)).triggered).toBe(true);
    expect((await check(m.id, u.id)).triggered).toBe(false);
    site.catalog = ["Alpha", "Bravo", "Charlie"];
    await check(m.id, u.id);
    site.catalog = ["Alpha", "Bravo", "Charlie", "Delta"];
    expect((await check(m.id, u.id)).triggered).toBe(false);
    const a = await alerts(m.id);
    expect(a).toHaveLength(1);
    expect(a[0]!.body).toContain("Delta");
    const [task] = await t.db.select({ s: monitoringTasks.ruleState }).from(monitoringTasks).where(eq(monitoringTasks.id, m.id));
    expect((task!.s as { seen: { items: string[] } }).seen.items.length).toBeGreaterThanOrEqual(4);
  });

  it("prix < 200 € ET en stock", async () => {
    const u = await subscriber();
    const m = await monitor(u.id, "/produit", { type: "rule", category: "price", conditions: [{ type: "price_below", value: 200 }, { type: "stock_is", state: "in_stock" }] });
    site.price = "249,00";
    site.stock = true;
    expect((await check(m.id, u.id)).triggered).toBe(false);
    site.price = "189,00";
    site.stock = false;
    expect((await check(m.id, u.id)).triggered).toBe(false);
    site.stock = true;
    const r = await check(m.id, u.id);
    expect(r.triggered).toBe(true);
    expect((await alerts(m.id))[0]!.title).toMatch(/Prix sous 200/);
  });

  it("nouvelle version d'un PDF (empreinte des octets) et texte extrait", async () => {
    const u = await subscriber();
    const m = await monitor(u.id, "/resultats.pdf", { type: "rule", category: "document", conditions: [{ type: "page_changed", sensitivity: "any" }] });
    await check(m.id, u.id);
    const [first] = await t.db.select({ o: monitoringResults.observation }).from(monitoringResults).where(eq(monitoringResults.taskId, m.id));
    expect(first!.o).toMatchObject({ contentKind: "pdf", excerpt: expect.stringContaining("Resultats provisoires") });
    site.pdfText = "Resultats definitifs du concours.";
    expect((await check(m.id, u.id)).triggered).toBe(true);
  });

  it("nouveau document publié sur une page", async () => {
    const u = await subscriber();
    const m = await monitor(u.id, "/documents", { type: "rule", category: "document", conditions: [{ type: "document_added", contains: "résultats" }] });
    await check(m.id, u.id);
    site.docs = [...site.docs, ["Résultats 2026", "/resultats.pdf"]];
    expect((await check(m.id, u.id)).triggered).toBe(true);
  });

  it("site inaccessible confirmé sur 2 contrôles, puis retour à la normale ; la surveillance ne passe pas en erreur", async () => {
    const u = await subscriber();
    const m = await monitor(u.id, "/statut", { type: "rule", category: "uptime", conditions: [{ type: "site_down" }], options: { notifyRecovery: true } });
    await check(m.id, u.id);
    site.status = 503;
    expect((await check(m.id, u.id)).triggered).toBe(false);
    site.status = 200;
    site.hang = true;
    expect((await check(m.id, u.id)).triggered).toBe(true);
    for (let i = 0; i < 5; i++) await check(m.id, u.id);
    site.hang = false;
    expect((await check(m.id, u.id)).triggered).toBe(true);
    expect((await alerts(m.id)).map((a) => a.title)).toEqual(["Site inaccessible", "Site de nouveau accessible"]);
    const [task] = await t.db.select({ status: monitoringTasks.status }).from(monitoringTasks).where(eq(monitoringTasks.id, m.id));
    expect(task!.status).toBe("active");
  }, 30_000);
});

describe("validation, quotas et compatibilité", () => {
  it("refuse les règles invalides ou impossibles à vérifier", async () => {
    const u = await subscriber();
    await expect(monitor(u.id, "/produit", { type: "rule", conditions: [] })).rejects.toBeInstanceOf(MonitorError);
    await expect(monitor(u.id, "/produit", { type: "rule", conditions: [{ type: "element_present" }] })).rejects.toThrow(/zone ou l'élément/);
    await expect(monitor(u.id, "/statut", { type: "rule", match: "all", conditions: [{ type: "site_down" }, { type: "page_changed" }] })).rejects.toThrow(/disponibilité/);
    await expect(monitor(u.id, "/produit", { type: "rule", conditions: [{ type: "text_match", terms: ["x".repeat(500)] }] })).rejects.toBeInstanceOf(MonitorError);
  });

  it("21-22. une règle compte pour UNE surveillance, à la fréquence minimale de la formule (Plus : 20, 6 h)", async () => {
    const u = await subscriber("plus");
    const many = { type: "rule" as const, match: "any" as const, conditions: [{ type: "price_below" as const, value: 10 }, { type: "item_added" as const }, { type: "page_changed" as const }, { type: "document_added" as const }] };
    const m = await monitor(u.id, "/produit", many, { intervalMinutes: 5 }).catch((e: unknown) => e);
    expect(m).toBeInstanceOf(QuotaError);
    const ok = await monitor(u.id, "/produit", many);
    const [s] = await t.db.select({ i: monitoringSchedules.intervalMinutes }).from(monitoringSchedules).where(eq(monitoringSchedules.taskId, ok.id));
    expect(s!.i).toBe(360);
    for (let i = 1; i < 20; i++) await monitor(u.id, `/produit?n=${i}`, { type: "rule", conditions: [{ type: "page_changed" }] });
    await expect(monitor(u.id, "/produit?n=21", { type: "rule", conditions: [{ type: "page_changed" }] })).rejects.toBeInstanceOf(QuotaError);
  });

  it("aucune surveillance sans abonnement, même avec une règle", async () => {
    const u = await createTestUser(t);
    await expect(monitor(u.id, "/produit", { type: "rule", conditions: [{ type: "page_changed" }] })).rejects.toBeInstanceOf(QuotaError);
  });

  it("25. une surveillance de l'ancien système fonctionne toujours à côté des règles", async () => {
    const u = await subscriber();
    const m = await monitor(u.id, "/produit", { type: "price_below", threshold: 150, currency: "EUR" });
    site.price = "199,00";
    await check(m.id, u.id);
    site.price = "149,00";
    expect((await check(m.id, u.id)).triggered).toBe(true);
    const [task] = await t.db.select({ s: monitoringTasks.ruleState, c: monitoringTasks.condition }).from(monitoringTasks).where(eq(monitoringTasks.id, m.id));
    expect(task!.s).toEqual({});
    expect(task!.c).toMatchObject({ type: "price_below" });
  });
});

describe("coût de stockage", () => {
  it("les listes détaillées ne sont conservées que sur le dernier résultat réussi", async () => {
    const u = await subscriber();
    const m = await monitor(u.id, "/catalogue", { type: "rule", conditions: [{ type: "item_added" }] });
    await check(m.id, u.id);
    await check(m.id, u.id);
    await check(m.id, u.id);
    const rows = await t.db.execute<{ heavy: boolean }>(sql`select (observation ? 'items') as heavy from monitoring_results where task_id = ${m.id} order by checked_at`);
    expect(rows.map((r) => r.heavy)).toEqual([false, false, true]);
  });
});
