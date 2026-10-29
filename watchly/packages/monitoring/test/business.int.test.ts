/**
 * Moteur C (Business) contre une vraie base PostgreSQL, de vrais serveurs HTTP/HTTPS locaux
 * et un vrai Chromium : vérification de propriété, quotas, confirmation des pannes,
 * incidents et rétablissements, certificats, scénarios (avec blocage des achats), statistiques.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import http from "node:http";
import https from "node:https";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  artifacts,
  browserTestRuns,
  businessEndpoints,
  businessSites,
  eq,
  incidentEvents,
  incidents,
  notifications,
  siteVerifications,
  sql,
  subscriptions,
} from "@watchly/database";
import { createTestDatabase, createTestUser, type TestDatabase } from "@watchly/database/testing";
import { QuotaError, recomputeEntitlements } from "@watchly/billing";
import {
  BusinessError,
  checkEndpoint,
  checkTls,
  claimDueEndpoints,
  createEndpoint,
  createScenario,
  createSite,
  recordEndpointResult,
  recordScenarioRun,
  rollupDailyStats,
  runScenario,
  runTlsPass,
  utcDay,
  verifySite,
  type ClaimedEndpoint,
} from "../src/business";
import { BrowserPool } from "../src/browser/pool";

const LOCAL = { allowLoopback: true, allowAnyPort: true, allowLocalhostName: true };
let t: TestDatabase;

// --- Site local de test ------------------------------------------------------
let healthy = true;
let posts = 0;
const site = http.createServer((req, res) => {
  if (req.method === "POST") posts++;
  const html = (body: string) => res.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end(`<!doctype html><title>Boutique</title>${body}`);
  switch (req.url) {
    case "/":
      if (!healthy) return void res.writeHead(503).end("maintenance");
      return html(`<h1>Accueil</h1><a href="/produits">Produits</a><p>Bienvenue chez Boutique Test</p>`);
    case "/produits":
      return html(`<h1>Produits</h1><p>Casque audio</p><a href="/panier">Panier</a>`);
    case "/panier":
      return html(`<h1>Panier</h1><form method="post" action="/payer"><input name="card-number" id="card"><button id="pay" type="submit">Payer maintenant</button></form>`);
    case "/.well-known/watchly-verification.txt":
      return void res.writeHead(200, { "content-type": "text/plain" }).end(fileToken);
    default:
      return void res.writeHead(404).end();
  }
});
let base = "";
let fileToken = "";

beforeAll(async () => {
  t = await createTestDatabase();
  await new Promise<void>((r) => site.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${(site.address() as { port: number }).port}`;
});
afterAll(async () => {
  site.close();
  await t?.drop();
});

async function businessUser() {
  const u = await createTestUser(t);
  await t.db.insert(subscriptions).values({
    userId: u.id,
    planId: "business",
    stripeSubscriptionId: `sub_${u.id}`,
    stripeCustomerId: `cus_${u.id}`,
    status: "active",
    currentPeriodEnd: new Date(Date.now() + 20 * 86_400_000),
  });
  await recomputeEntitlements(t.db, u.id);
  return u;
}

async function verifiedSite(userId: string, domain = `boutique-${Math.random().toString(36).slice(2, 8)}.test`) {
  const s = await createSite(t.db, userId, { name: "Boutique", domain });
  await t.db.update(businessSites).set({ status: "verified", verifiedAt: new Date() }).where(eq(businessSites.id, s.id));
  return { ...s, domain };
}

describe("sites professionnels : quotas et preuve de propriété", () => {
  it("refuse Business aux formules qui ne l'incluent pas", async () => {
    const free = await createTestUser(t);
    await recomputeEntitlements(t.db, free.id);
    await expect(createSite(t.db, free.id, { name: "X", domain: "x.example.com" })).rejects.toBeInstanceOf(QuotaError);
  });

  it("applique le quota de sites et refuse les doublons", async () => {
    const u = await businessUser();
    await createSite(t.db, u.id, { name: "Site", domain: "https://www.Exemple-Pro.fr/accueil" });
    const [s] = await t.db.select().from(businessSites).where(eq(businessSites.userId, u.id));
    expect(s!.domain).toBe("exemple-pro.fr");
    expect(s!.status).toBe("pending_verification");
    await expect(createSite(t.db, u.id, { name: "Autre", domain: "autre.fr" })).rejects.toMatchObject({ code: "site_limit" });
  });

  it("vérifie la propriété par enregistrement DNS TXT", async () => {
    const u = await businessUser();
    const s = await createSite(t.db, u.id, { name: "DNS", domain: "dns-ok.fr" });
    const wrong = await verifySite(t.db, u.id, s.id, "dns", { resolveTxt: async () => [["watchly-verification=autre"]] });
    expect(wrong.verified).toBe(false);
    await expect(verifySite(t.db, u.id, s.id, "dns", { resolveTxt: async () => [] })).rejects.toMatchObject({ code: "too_soon" });
    const ok = await verifySite(
      t.db,
      u.id,
      s.id,
      "dns",
      { resolveTxt: async (name) => (name === "_watchly.dns-ok.fr" ? [[s.verificationToken.slice(0, 20), s.verificationToken.slice(20)]] : []) },
      new Date(Date.now() + 20_000),
    );
    expect(ok.verified).toBe(true);
    const [row] = await t.db.select().from(businessSites).where(eq(businessSites.id, s.id));
    expect(row).toMatchObject({ status: "verified", verificationMethod: "dns" });
    const attempts = await t.db.select().from(siteVerifications).where(eq(siteVerifications.siteId, s.id));
    expect(attempts.map((a) => a.success)).toEqual([false, true]);
  });

  it("vérifie la propriété par fichier .well-known", async () => {
    const u = await businessUser();
    const s = await createSite(t.db, u.id, { name: "Fichier", domain: "fichier-ok.fr" });
    fileToken = "mauvais";
    expect((await verifySite(t.db, u.id, s.id, "file", { fileBaseUrl: base, fetchOptions: LOCAL })).verified).toBe(false);
    fileToken = s.verificationToken;
    const ok = await verifySite(t.db, u.id, s.id, "file", { fileBaseUrl: base, fetchOptions: LOCAL }, new Date(Date.now() + 20_000));
    expect(ok.verified).toBe(true);
  });

  it("un site d'un autre utilisateur est introuvable", async () => {
    const a = await businessUser();
    const b = await businessUser();
    const s = await createSite(t.db, a.id, { name: "A", domain: "site-a.fr" });
    await expect(verifySite(t.db, b.id, s.id, "dns", { resolveTxt: async () => [] })).rejects.toBeInstanceOf(BusinessError);
    await expect(createEndpoint(t.db, b.id, s.id, { name: "x", url: "https://site-a.fr/" })).rejects.toMatchObject({ code: "not_found" });
  });
});

describe("points de contrôle", () => {
  it("exigent un site vérifié, une adresse du domaine et respectent le quota", async () => {
    const u = await businessUser();
    const pending = await createSite(t.db, u.id, { name: "P", domain: "attente.fr" });
    await expect(createEndpoint(t.db, u.id, pending.id, { name: "Accueil", url: "https://attente.fr/" })).rejects.toMatchObject({ code: "not_verified" });
    await t.db.update(businessSites).set({ status: "verified" }).where(eq(businessSites.id, pending.id));
    await expect(createEndpoint(t.db, u.id, pending.id, { name: "Tiers", url: "https://autre-site.com/" })).rejects.toMatchObject({ code: "outside_domain" });
    await expect(createEndpoint(t.db, u.id, pending.id, { name: "Interne", url: "http://10.0.0.5/" })).rejects.toMatchObject({ code: "invalid_target" });
    for (const p of ["/", "/boutique", "/contact"]) await createEndpoint(t.db, u.id, pending.id, { name: p, url: `https://www.attente.fr${p}` });
    await expect(createEndpoint(t.db, u.id, pending.id, { name: "4e", url: "https://attente.fr/x" })).rejects.toMatchObject({ code: "endpoint_limit" });
  });

  it("contrôle HTTP : statut, mot-clé et erreurs réseau", async () => {
    healthy = true;
    const spec = { url: `${base}/`, method: "GET" as const, expectedStatusMin: 200, expectedStatusMax: 399, expectedKeyword: "Boutique Test", timeoutMs: 5000, slowThresholdMs: 3000 };
    expect(await checkEndpoint(spec, LOCAL)).toMatchObject({ ok: true, statusCode: 200 });
    expect(await checkEndpoint({ ...spec, expectedKeyword: "Absent" }, LOCAL)).toMatchObject({ ok: false, errorCode: "keyword_missing" });
    healthy = false;
    expect(await checkEndpoint(spec, LOCAL)).toMatchObject({ ok: false, statusCode: 503, errorCode: "unexpected_status" });
    healthy = true;
    expect(await checkEndpoint({ ...spec, url: "http://127.0.0.1:1/" }, LOCAL)).toMatchObject({ ok: false, errorCode: "network_error" });
    // Politique stricte (production) : adresse locale refusée.
    expect(await checkEndpoint(spec)).toMatchObject({ ok: false });
  });
});

describe("disponibilité : confirmation avant alerte, incident, rétablissement", () => {
  it("n'alerte qu'après un second échec et prévient du rétablissement", async () => {
    const u = await businessUser();
    const s = await verifiedSite(u.id);
    const ep = await createEndpoint(t.db, u.id, s.id, { name: "Accueil", url: `${base}/` }, LOCAL);
    let now = new Date();
    const claim = async (): Promise<ClaimedEndpoint> => {
      const c = await claimDueEndpoints(t.db, { workerId: "w1", max: 50, now });
      const mine = c.find((x) => x.id === ep.id);
      expect(mine, "point de contrôle non réservé").toBeDefined();
      return mine!;
    };

    const once = async () => {
      const c = await claim();
      const r = await checkEndpoint(c, LOCAL);
      return recordEndpointResult(t.db, c, "w1", r, now);
    };
    const advance = async () => {
      const [e] = await t.db.select().from(businessEndpoints).where(eq(businessEndpoints.id, ep.id));
      now = new Date(e!.nextCheckAt.getTime() + 1);
      return e!;
    };

    healthy = true;
    expect((await once()).state).toBe("up");
    await advance();

    healthy = false;
    const first = await once();
    expect(first).toMatchObject({ state: "up", incidentOpened: null });
    const afterFirst = await advance();
    expect(afterFirst.consecutiveFailures).toBe(1);
    expect(afterFirst.nextCheckAt.getTime() - afterFirst.lastCheckedAt!.getTime()).toBe(20_000);
    expect(await t.db.select().from(notifications).where(eq(notifications.userId, u.id))).toHaveLength(0);

    const second = await once();
    expect(second.state).toBe("down");
    expect(second.incidentOpened).toBeTruthy();
    await advance();
    const third = await once();
    expect(third.incidentOpened).toBeNull(); // un seul incident ouvert
    await advance();

    const [inc] = await t.db.select().from(incidents).where(eq(incidents.endpointId, ep.id));
    expect(inc).toMatchObject({ status: "open", kind: "downtime", failedChecks: 3 });
    const alerts = await t.db.select().from(notifications).where(eq(notifications.userId, u.id));
    expect(alerts.map((n) => [n.type, n.priority])).toEqual([["business_down", "critical"]]);
    expect(alerts[0]!.emailStatus).toBe("pending");

    healthy = true;
    expect((await once()).state).toBe("down"); // une seule réussite ne suffit pas
    await advance();
    const back = await once();
    expect(back.state).toBe("up");
    expect(back.incidentResolved).toBe(inc!.id);
    const [resolved] = await t.db.select().from(incidents).where(eq(incidents.id, inc!.id));
    expect(resolved!.status).toBe("resolved");
    const events = await t.db.select().from(incidentEvents).where(eq(incidentEvents.incidentId, inc!.id));
    expect(events.map((e) => e.type)).toEqual(["detected", "confirmed", "notified", "recovered"]);
    const types = (await t.db.select().from(notifications).where(eq(notifications.userId, u.id))).map((n) => n.type).sort();
    expect(types).toEqual(["business_down", "business_recovered"]);

    // Statistiques du jour : les contrôles de confirmation ne sont pas comptés deux fois.
    await rollupDailyStats(t.db, [utcDay(new Date()), utcDay(now)]);
    const stats = await t.db.execute<{ checks: number; failures: number; downtime_seconds: number }>(sql`
      select sum(checks)::int as checks, sum(failures)::int as failures, sum(downtime_seconds)::int as downtime_seconds
      from business_daily_stats where endpoint_id = ${ep.id}`);
    // 6 contrôles dont 1 re-vérification rapprochée : 5 échantillons, 2 en échec.
    expect(stats[0]).toMatchObject({ checks: 5, failures: 2 });
    expect(stats[0]!.downtime_seconds).toBeGreaterThan(0);
  });

  it("ne contrôle pas les sites d'une formule qui n'inclut plus Business, ni deux fois le même point", async () => {
    const u = await businessUser();
    const s = await verifiedSite(u.id);
    const ep = await createEndpoint(t.db, u.id, s.id, { name: "Accueil", url: `${base}/` }, LOCAL);
    const [a, b] = await Promise.all([
      claimDueEndpoints(t.db, { workerId: "wa", max: 500 }),
      claimDueEndpoints(t.db, { workerId: "wb", max: 500 }),
    ]);
    expect([...a, ...b].filter((c) => c.id === ep.id)).toHaveLength(1);
    await t.db.update(businessEndpoints).set({ leaseExpiresAt: null, leaseOwner: null }).where(eq(businessEndpoints.id, ep.id));
    await t.db.update(subscriptions).set({ status: "canceled", endedAt: new Date() }).where(eq(subscriptions.userId, u.id));
    await recomputeEntitlements(t.db, u.id);
    const c = await claimDueEndpoints(t.db, { workerId: "wc", max: 500 });
    expect(c.find((x) => x.id === ep.id)).toBeUndefined();
  });
});

describe("certificats HTTPS", () => {
  const dir = mkdtempSync(join(tmpdir(), "watchly-tls-"));
  let server: https.Server;
  let port = 0;
  let ca: Buffer;
  beforeAll(async () => {
    execFileSync("openssl", [
      "req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "10", "-subj", "/CN=tls-ok.test",
      "-addext", "subjectAltName=DNS:tls-ok.test", "-keyout", join(dir, "key.pem"), "-out", join(dir, "cert.pem"),
    ], { stdio: "ignore" });
    ca = readFileSync(join(dir, "cert.pem"));
    server = https.createServer({ key: readFileSync(join(dir, "key.pem")), cert: ca }, (_req, res) => res.end("ok"));
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    port = (server.address() as { port: number }).port;
  });
  afterAll(() => server?.close());

  const opts = () => ({ port, allowLoopback: true, resolve: async () => ["127.0.0.1"], ca });

  it("lit l'expiration et l'émetteur d'un certificat valide", async () => {
    const r = await checkTls("tls-ok.test", opts());
    expect(r.ok).toBe(true);
    expect(r.validTo!.getTime()).toBeGreaterThan(Date.now() + 8 * 86_400_000);
  });

  it("détecte un certificat non reconnu ou ne correspondant pas au nom", async () => {
    expect(await checkTls("tls-ok.test", { ...opts(), ca: undefined })).toMatchObject({ ok: false, errorCode: "DEPTH_ZERO_SELF_SIGNED_CERT" });
    expect(await checkTls("autre-nom.test", opts())).toMatchObject({ ok: false, errorCode: "ERR_TLS_CERT_ALTNAME_INVALID" });
  });

  it("refuse les adresses privées en production", async () => {
    expect(await checkTls("tls-ok.test", { ...opts(), allowLoopback: false })).toMatchObject({ ok: false, errorCode: "blocked_address" });
  });

  it("ouvre un incident pour une expiration proche (< 14 jours) puis le clôt après renouvellement", async () => {
    const u = await businessUser();
    const s = await verifiedSite(u.id, "tls-ok.test");
    await t.db.update(businessSites).set({ nextTlsCheckAt: new Date(Date.now() - 1000) }).where(eq(businessSites.id, s.id));
    await runTlsPass(t.db, { max: 50, tls: opts() });
    const [inc] = await t.db.select().from(incidents).where(eq(incidents.siteId, s.id));
    expect(inc).toMatchObject({ kind: "tls", status: "open", title: "Certificat HTTPS bientôt expiré" });
    const [row] = await t.db.select().from(businessSites).where(eq(businessSites.id, s.id));
    expect(row!.tlsValidTo).not.toBeNull();
    expect(row!.nextTlsCheckAt!.getTime()).toBeGreaterThan(Date.now() + 23 * 3_600_000);
    // Contrôle suivant, simulé 30 jours plus tôt (le certificat paraît valide encore 40 jours) : incident clos.
    await t.db.update(businessSites).set({ nextTlsCheckAt: new Date(Date.now() - 40 * 86_400_000) }).where(eq(businessSites.id, s.id));
    await runTlsPass(t.db, { max: 50, tls: opts(), now: new Date(Date.now() - 30 * 86_400_000) });
    const [after] = await t.db.select().from(incidents).where(eq(incidents.id, inc!.id));
    expect(after!.status).toBe("resolved");
  });

  it("une erreur réseau passagère ne crée pas d'incident", async () => {
    const u = await businessUser();
    const s = await verifiedSite(u.id, "tls-panne.test");
    await t.db.update(businessSites).set({ nextTlsCheckAt: new Date(Date.now() - 1000) }).where(eq(businessSites.id, s.id));
    await runTlsPass(t.db, { max: 50, tls: { ...opts(), port: 1 } });
    expect(await t.db.select().from(incidents).where(eq(incidents.siteId, s.id))).toHaveLength(0);
    const [row] = await t.db.select().from(businessSites).where(eq(businessSites.id, s.id));
    expect(row!.nextTlsCheckAt!.getTime()).toBeLessThan(Date.now() + 2 * 3_600_000);
  });
});

describe("scénarios navigateur (Chromium réel)", () => {
  const pool = new BrowserPool({ maxConcurrency: 2, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ?? "/opt/pw-browsers/chromium", egress: { allowLoopback: true, allowAnyPort: true } });
  beforeAll(() => {
    healthy = true;
  });
  afterAll(() => pool.close());

  it("refuse à la création une étape d'achat", async () => {
    const u = await businessUser();
    const s = await verifiedSite(u.id);
    await expect(
      createScenario(t.db, u.id, s.id, { name: "Achat", startUrl: `${base}/panier`, steps: [{ action: "click", selector: "text=Payer maintenant" }] }, LOCAL),
    ).rejects.toMatchObject({ code: "blocked_step" });
    await expect(
      createScenario(t.db, u.id, s.id, { name: "Tiers", startUrl: "https://autre-site.com/", steps: [{ action: "wait", ms: 100 }] }),
    ).rejects.toMatchObject({ code: "outside_domain" });
  });

  it("exécute un parcours qui réussit", async () => {
    const r = await runScenario(
      pool,
      {
        startUrl: `${base}/`,
        domain: "boutique.test",
        steps: [
          { action: "expect_text", text: "Bienvenue" },
          { action: "click", selector: "a:has-text('Produits')" },
          { action: "expect_url", contains: "/produits" },
          { action: "expect_visible", selector: "h1" },
        ],
      },
      LOCAL,
    );
    expect(r.status, r.error ?? "").toBe("passed");
    expect(r.steps).toHaveLength(4);
  }, 60_000);

  it("bloque un clic de paiement et toute saisie de carte, sans aucune requête envoyée", async () => {
    posts = 0;
    const pay = await runScenario(pool, { startUrl: `${base}/panier`, domain: "boutique.test", steps: [{ action: "click", selector: "#pay" }] }, LOCAL);
    expect(pay.status).toBe("error");
    expect(pay.error).toMatch(/bloquée/);
    const card = await runScenario(pool, { startUrl: `${base}/panier`, domain: "boutique.test", steps: [{ action: "fill", selector: "#card", value: "4242424242424242" }] }, LOCAL);
    expect(card.status).toBe("error");
    expect(posts).toBe(0);
  }, 60_000);

  it("échec confirmé : capture d'écran, incident après deux échecs, rétablissement", async () => {
    const u = await businessUser();
    const s = await verifiedSite(u.id);
    const created = await createScenario(t.db, u.id, s.id, { name: "Parcours produit", startUrl: `${base}/`, steps: [{ action: "expect_text", text: "Introuvable" }] }, LOCAL);
    const row = {
      id: created.id,
      site_id: s.id,
      user_id: u.id,
      site_name: "Boutique",
      domain: s.domain,
      name: "Parcours produit",
      start_url: `${base}/`,
      steps: [{ action: "expect_text", text: "Introuvable" }],
      interval_minutes: 120,
      consecutive_failures: 0,
    };
    const lease = () => t.db.execute(sql`update browser_test_scenarios set lease_owner = 'w' where id = ${created.id}`);
    const failing = await runScenario(pool, { startUrl: row.start_url, steps: row.steps, domain: s.domain }, LOCAL);
    expect(failing.status).toBe("failed");
    expect(failing.screenshot?.length).toBeGreaterThan(1000);

    await lease();
    await recordScenarioRun(t.db, row, failing, new Date(), new Date(), "w");
    expect(await t.db.select().from(incidents).where(eq(incidents.scenarioId, created.id))).toHaveLength(0);
    await lease();
    await recordScenarioRun(t.db, { ...row, consecutive_failures: 1 }, failing, new Date(), new Date(), "w");
    const [inc] = await t.db.select().from(incidents).where(eq(incidents.scenarioId, created.id));
    expect(inc).toMatchObject({ kind: "scenario", status: "open" });
    expect(inc!.screenshotId).not.toBeNull();
    const [shot] = await t.db.select({ ct: artifacts.contentType, userId: artifacts.userId }).from(artifacts).where(eq(artifacts.id, inc!.screenshotId!));
    expect(shot).toEqual({ ct: "image/jpeg", userId: u.id });
    expect(await t.db.select().from(browserTestRuns).where(eq(browserTestRuns.scenarioId, created.id))).toHaveLength(2);

    const passing = await runScenario(pool, { startUrl: row.start_url, steps: [{ action: "expect_text", text: "Bienvenue" }], domain: s.domain }, LOCAL);
    await lease();
    await recordScenarioRun(t.db, { ...row, consecutive_failures: 2 }, passing, new Date(), new Date(), "w");
    const [after] = await t.db.select().from(incidents).where(eq(incidents.id, inc!.id));
    expect(after!.status).toBe("resolved");
  }, 90_000);
});
