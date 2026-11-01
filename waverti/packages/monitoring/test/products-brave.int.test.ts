/**
 * Découverte Brave (lot 3) — tests d'intégration avec PostgreSQL.
 * Aucun appel Brave réel : fournisseurs simulés ou faux serveur HTTP au format Brave. Aucune clé réelle.
 */
import { createServer, type Server } from "node:http";
import type { LookupAddress } from "node:dns";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createDb, eq, providerRequests, readUsage, sql, usagePeriod, type DbHandle } from "@waverti/database";
import { createTestDatabase, createTestUser, type TestDatabase } from "@waverti/database/testing";
import { createBraveProvider, SearchProviderError, type SearchProvider, type SearchResultItem } from "../src/search/brave";
import { BudgetExceededError, loadBraveGlobalCap, reserveBraveCall } from "../src/search";
import {
  BraveOfferDiscoverySource,
  BraveSearchGateway,
  compareProduct,
  HttpOfferVerifier,
  productQueryHash,
  purgeAllBraveResults,
  purgeExpiredBraveCache,
  storageRightsFromEnv,
  type BraveLogEvent,
  type BraveRequester,
  type ProductTarget,
} from "../src/products";
import { braveBody, numworksResults } from "./brave-fixtures";
import { goodPage, GTIN, html, ldProduct, offer } from "./products-fixtures";

let t: TestDatabase;
let second: DbHandle;
const MONTH = usagePeriod("month");

beforeAll(async () => {
  t = await createTestDatabase();
  second = createDb(t.url, { max: 5 });
});
afterAll(async () => {
  await second?.close();
  await t?.drop();
});
beforeEach(async () => {
  await t.client`delete from usage_counters`;
  await t.client`delete from search_cache`;
  await t.client`delete from provider_requests`;
  await t.client`delete from app_settings where key like '%brave%'`;
});

const setSetting = (key: string, value: number) => t.client`insert into app_settings (key, value) values (${key}, ${JSON.stringify(value)}::jsonb) on conflict (key) do update set value = excluded.value`;
const item = (url: string, title: string, description = ""): SearchResultItem => ({ url, title, description, age: null, publishedAt: null, hostname: new URL(url).hostname });
const ITEMS = [item("https://boutique-a.test/p", "NumWorks N0120 calculatrice")];

interface FakeProvider extends SearchProvider {
  calls: string[];
}
function fakeProvider(opts: { delayMs?: number; fail?: (call: number) => Error | null; items?: SearchResultItem[]; status?: number } = {}): FakeProvider {
  const calls: string[] = [];
  return {
    name: "brave",
    calls,
    async search(q, o) {
      calls.push(q);
      if (opts.delayMs) await new Promise((r) => setTimeout(r, opts.delayMs));
      const err = opts.fail?.(calls.length);
      o?.onResponse?.({ status: err instanceof SearchProviderError ? (err.status ?? 500) : (opts.status ?? 200), quotaRemaining: 9000, quotaLimit: 15000 });
      if (err) throw err;
      return opts.items ?? ITEMS;
    },
  };
}
const requester = async (over: Partial<BraveRequester> = {}): Promise<BraveRequester> => ({ userId: (await createTestUser(t)).id, period: MONTH, periodLimit: 600, dailyLimit: null, ...over });
const gw = (provider: SearchProvider | null, o: Partial<ConstructorParameters<typeof BraveSearchGateway>[0]> = {}, handle: DbHandle = t) => {
  const events: BraveLogEvent[] = [];
  return { gateway: new BraveSearchGateway({ db: handle.db, provider, logger: (e) => events.push(e), ...o }), events };
};
const counter = (userId: string | null, metric: "brave_api_global" | "brave_search", period = MONTH) => readUsage(t.db, { userId, metric, period });

describe("plafond mensuel global (50 $ par défaut) et réglages", () => {
  it("valeur initiale : 50 $ à 0,005 $ l'appel = 10 000 appels par mois", async () => {
    expect(await loadBraveGlobalCap(t.db)).toEqual({ budgetUsd: 50, costMicros: 5000, maxRequests: 10_000 });
  });
  it("configurable sans déploiement (app_settings) ; un coût nul est ramené à 1 micro-dollar, jamais de division par zéro", async () => {
    await setSetting("budget.brave_monthly_usd", 100);
    await setSetting("cost.brave_request_usd_micros", 4000);
    expect((await loadBraveGlobalCap(t.db)).maxRequests).toBe(25_000);
    await setSetting("cost.brave_request_usd_micros", 0);
    expect((await loadBraveGlobalCap(t.db)).costMicros).toBe(1);
    await setSetting("budget.brave_monthly_usd", -5);
    expect((await loadBraveGlobalCap(t.db)).maxRequests).toBe(0);
  });
});

describe("réservation atomique (plafond global + quota de l'abonnement)", () => {
  const reserve = (handle: DbHandle, userId: string, over: Partial<Parameters<typeof reserveBraveCall>[0]> = {}) =>
    reserveBraveCall({ db: handle.db, userId, period: MONTH, periodLimit: 1000, dailyLimit: null, globalMonthlyRequests: 10, ...over });

  it("40 réservations simultanées depuis deux workers, plafond 10 : exactement 10 acceptées, jamais 11", async () => {
    const users = await Promise.all(Array.from({ length: 40 }, () => createTestUser(t)));
    const results = await Promise.allSettled(users.map((u, i) => reserve(i % 2 ? second : t, u.id)));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(10);
    const rejected = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
    expect(rejected).toHaveLength(30);
    expect(rejected.every((r) => r.reason instanceof BudgetExceededError && r.reason.scope === "global")).toBe(true);
    expect(await counter(null, "brave_api_global")).toBe(10);
  });
  it("quota de l'abonnement : refus au-delà, sans fuite sur le compteur global", async () => {
    const u = await createTestUser(t);
    for (let i = 0; i < 3; i++) await reserve(t, u.id, { periodLimit: 3 });
    await expect(reserve(t, u.id, { periodLimit: 3 })).rejects.toMatchObject({ scope: "user_month" });
    expect(await counter(u.id, "brave_search")).toBe(3);
    expect(await counter(null, "brave_api_global")).toBe(3);
  });
  it("plafond journalier d'essai : le compteur de période est restitué", async () => {
    const u = await createTestUser(t);
    await reserve(t, u.id, { periodLimit: 50, dailyLimit: 1 });
    await expect(reserve(t, u.id, { periodLimit: 50, dailyLimit: 1 })).rejects.toMatchObject({ scope: "user_day" });
    expect(await counter(u.id, "brave_search")).toBe(1);
    expect(await counter(null, "brave_api_global")).toBe(1);
  });
  it("release() restitue tout ; releaseUserOnly() garde la dépense globale (appel peut-être facturé)", async () => {
    const u = await createTestUser(t);
    const a = await reserve(t, u.id);
    await a.release();
    expect([await counter(u.id, "brave_search"), await counter(null, "brave_api_global")]).toEqual([0, 0]);
    const b = await reserve(t, u.id);
    await b.releaseUserOnly();
    expect([await counter(u.id, "brave_search"), await counter(null, "brave_api_global")]).toEqual([0, 1]);
  });
  it("plafond à zéro : aucune réservation possible", async () => {
    const u = await createTestUser(t);
    await expect(reserve(t, u.id, { globalMonthlyRequests: 0 })).rejects.toMatchObject({ scope: "global" });
  });
});

describe("droits de stockage Brave : aucun stockage sans confirmation", () => {
  it("seule la valeur exacte « granted » active le cache ; tout le reste = aucun stockage", () => {
    expect(storageRightsFromEnv({})).toBe("none");
    for (const v of ["", "true", "yes", "1", "GRANTED", "Granted", "none", " granted"]) expect(storageRightsFromEnv({ WAVERTI_BRAVE_STORAGE_RIGHTS: v })).toBe("none");
    expect(storageRightsFromEnv({ WAVERTI_BRAVE_STORAGE_RIGHTS: "granted" })).toBe("granted");
  });
  it("par défaut : aucun résultat écrit en base, deux recherches identiques successives = deux appels facturés", async () => {
    const p = fakeProvider();
    const { gateway } = gw(p);
    const r1 = await requester();
    const a = await gateway.search("NumWorks N0120", r1);
    const b = await gateway.search("NumWorks N0120", r1);
    expect([a.fromCache, b.fromCache]).toEqual([false, false]);
    expect(p.calls).toHaveLength(2);
    expect(await t.client`select count(*)::int as n from search_cache`).toEqual([{ n: 0 }]);
    expect(await counter(null, "brave_api_global")).toBe(2);
  });
  it("requêtes identiques simultanées fusionnées : un seul appel, facturé une fois à l'utilisateur qui l'a lancé", async () => {
    const p = fakeProvider({ delayMs: 80 });
    const { gateway } = gw(p);
    const [u1, u2, u3] = [await requester(), await requester(), await requester()];
    const res = await Promise.all([gateway.search("NumWorks N0120", u1), gateway.search("NumWorks N0120", u2), gateway.search("NumWorks N0120", u3)]);
    expect(p.calls).toHaveLength(1);
    expect(res.map((r) => r.apiCalls).sort()).toEqual([0, 0, 1]);
    expect(res.filter((r) => r.shared)).toHaveLength(2);
    expect(await counter(null, "brave_api_global")).toBe(1);
    expect((await Promise.all([u1, u2, u3].map((u) => counter(u.userId, "brave_search")))).sort()).toEqual([0, 0, 1]);
    expect(await t.client`select count(*)::int as n from search_cache`).toEqual([{ n: 0 }]);
  });
  it("le quota personnel épuisé du premier demandeur ne prive pas les autres : ils interrogent avec le leur", async () => {
    const p = fakeProvider({ delayMs: 60 });
    const { gateway } = gw(p);
    const broke = await requester({ periodLimit: 0 });
    const fine = await requester();
    const [a, b] = await Promise.allSettled([gateway.search("NumWorks N0120", broke), gateway.search("NumWorks N0120", fine)]);
    expect(a.status).toBe("rejected");
    expect(b.status).toBe("fulfilled");
    expect(p.calls).toHaveLength(1);
  });
  it("plafond global atteint : tous les demandeurs sont refusés, Brave n'est jamais appelé", async () => {
    await setSetting("budget.brave_monthly_usd", 0);
    const p = fakeProvider();
    const { gateway, events } = gw(p);
    await expect(gateway.search("x", await requester())).rejects.toMatchObject({ scope: "global" });
    expect(p.calls).toHaveLength(0);
    expect(events.some((e) => e.event === "brave_refused" && e.scope === "global")).toBe(true);
  });
});

describe("cache partagé PostgreSQL (droits de stockage confirmés)", () => {
  const granted = { storageRights: "granted" as const };
  it("un appel facturé, puis toute recherche identique est servie sans appel ni quota consommé, quel que soit l'utilisateur", async () => {
    const p = fakeProvider();
    const { gateway } = gw(p, granted);
    const [u1, u2] = [await requester(), await requester()];
    const a = await gateway.search("NumWorks N0120", u1);
    const b = await gateway.search("  numworks   N0120 ", u2); // requête normalisée
    expect([a.fromCache, a.apiCalls, b.fromCache, b.apiCalls]).toEqual([false, 1, true, 0]);
    expect(p.calls).toHaveLength(1);
    expect(await counter(null, "brave_api_global")).toBe(1);
    expect([await counter(u1.userId, "brave_search"), await counter(u2.userId, "brave_search")]).toEqual([1, 0]);
    const [row] = await t.client<{ provider: string; hit_count: number; results: unknown[] }[]>`select provider, hit_count, results from search_cache`;
    expect(row).toMatchObject({ provider: "brave_products", hit_count: 1 });
    expect(row!.results).toHaveLength(1);
    expect(gateway.stats).toMatchObject({ apiCalls: 1, cacheHits: 1 });
  });
  it("durée écoulée : nouvelle recherche facturée ; contenu illisible en cache : traité comme absent", async () => {
    const p = fakeProvider();
    const { gateway } = gw(p, granted);
    const r = await requester();
    await gateway.search("q1", r);
    await t.client`update search_cache set expires_at = now() - interval '1 second'`;
    expect((await gateway.search("q1", r)).fromCache).toBe(false);
    await t.client`update search_cache set results = '{"pas":"une liste"}'::jsonb where query_hash = ${productQueryHash("q1")}`;
    expect((await gateway.search("q1", r)).fromCache).toBe(false);
    expect(p.calls).toHaveLength(3);
  });
  it("deux workers (deux connexions, deux processus simulés), 10 demandes simultanées de la même requête : UN seul appel Brave", async () => {
    const pA = fakeProvider({ delayMs: 150 });
    const pB = fakeProvider({ delayMs: 150 });
    const A = gw(pA, granted, t).gateway;
    const B = gw(pB, granted, second).gateway;
    const users = await Promise.all(Array.from({ length: 10 }, () => requester()));
    const results = await Promise.all(users.map((u, i) => (i % 2 ? B : A).search("NumWorks N0120 GTIN", u)));
    expect(pA.calls.length + pB.calls.length).toBe(1);
    expect(results.every((r) => r.items.length === 1)).toBe(true);
    expect(results.reduce((n, r) => n + r.apiCalls, 0)).toBe(1);
    expect(await counter(null, "brave_api_global")).toBe(1);
    expect(await t.client`select count(*)::int as n from search_cache`).toEqual([{ n: 1 }]);
  });
  it("requêtes distinctes simultanées depuis deux workers : une facturation chacune, aucune perdue", async () => {
    const A = gw(fakeProvider({ delayMs: 40 }), granted, t).gateway;
    const B = gw(fakeProvider({ delayMs: 40 }), granted, second).gateway;
    await Promise.all(Array.from({ length: 12 }, async (_, i) => (i % 2 ? B : A).search(`requête ${i % 6}`, await requester())));
    expect(await counter(null, "brave_api_global")).toBe(6);
  });
  it("hygiène : purge des résultats expirés, puis destruction totale (fin de contrat ou retrait des droits)", async () => {
    const { gateway } = gw(fakeProvider(), granted);
    const r = await requester();
    await gateway.search("a", r);
    await gateway.search("b", r);
    await t.client`update search_cache set expires_at = now() - interval '1 hour' where query = 'a'`;
    expect(await purgeExpiredBraveCache(t.db)).toBe(1);
    expect(await purgeAllBraveResults(t.db)).toBe(1);
    expect(await t.client`select count(*)::int as n from search_cache`).toEqual([{ n: 0 }]);
  });
});

describe("erreurs : jamais de retry, comptabilité exacte", () => {
  const providerRows = () => t.db.select().from(providerRequests).where(eq(providerRequests.provider, "brave_search"));

  it("429 : un seul appel (pas de relance), tout est restitué, coût 0", async () => {
    const p = fakeProvider({ fail: () => new SearchProviderError("Brave HTTP 429", true, 429) });
    const { gateway } = gw(p);
    const r = await requester();
    await expect(gateway.search("x", r)).rejects.toMatchObject({ status: 429 });
    expect(p.calls).toHaveLength(1);
    expect([await counter(null, "brave_api_global"), await counter(r.userId, "brave_search")]).toEqual([0, 0]);
    const [row] = await providerRows();
    expect(row).toMatchObject({ outcome: "rate_limited", httpStatus: 429, attempt: 1, isRetry: false, estimatedCostMicros: 0 });
  });
  it.each([401, 403, 422])("erreur client %s : non facturée, tout restitué", async (status) => {
    const { gateway } = gw(fakeProvider({ fail: () => new SearchProviderError(`Brave HTTP ${status}`, false, status) }));
    const r = await requester();
    await expect(gateway.search("x", r)).rejects.toBeInstanceOf(SearchProviderError);
    expect([await counter(null, "brave_api_global"), await counter(r.userId, "brave_search")]).toEqual([0, 0]);
  });
  it.each([
    ["erreur serveur 503", () => new SearchProviderError("Brave HTTP 503", true, 503), "failure"],
    ["réponse illisible", () => new SearchProviderError("Brave : réponse illisible (JSON invalide)", false, 200), "failure"],
    ["délai dépassé", () => Object.assign(new Error("The operation was aborted due to timeout"), { name: "TimeoutError" }), "timeout"],
  ])("%s : peut-être facturé → dépense globale CONSERVÉE, quota de l'utilisateur rendu, jamais de relance", async (_n, mkErr, outcome) => {
    const p = fakeProvider({ fail: () => mkErr() });
    const { gateway } = gw(p);
    const r = await requester();
    await expect(gateway.search("x", r)).rejects.toBeTruthy();
    expect(p.calls).toHaveLength(1);
    expect([await counter(null, "brave_api_global"), await counter(r.userId, "brave_search")]).toEqual([1, 0]);
    const [row] = await providerRows();
    expect(row).toMatchObject({ outcome, attempt: 1, isRetry: false, estimatedCostMicros: 5000 });
  });
  it("aucune clé configurée : erreur explicite, rien n'est réservé", async () => {
    const { gateway } = gw(null);
    const r = await requester();
    await expect(gateway.search("x", r)).rejects.toThrow(/BRAVE_SEARCH_API_KEY/);
    expect([await counter(null, "brave_api_global"), await counter(r.userId, "brave_search")]).toEqual([0, 0]);
  });
  it("une erreur n'est jamais mise en cache : la recherche suivante réessaie (par décision de l'appelant, pas automatiquement)", async () => {
    const p = fakeProvider({ fail: (n) => (n === 1 ? new SearchProviderError("Brave HTTP 503", true, 503) : null) });
    const { gateway } = gw(p, { storageRights: "granted" });
    const r = await requester();
    await expect(gateway.search("x", r)).rejects.toBeTruthy();
    expect((await gateway.search("x", r)).items).toHaveLength(1);
    expect(p.calls).toHaveLength(2);
    expect(await t.client`select count(*)::int as n from search_cache`).toEqual([{ n: 1 }]);
  });
});

describe("journal de consommation : la clé API n'apparaît nulle part", () => {
  const KEY = "BSA-clé-ultra-secrète-ne-doit-jamais-fuiter-987654321";
  let server: Server;
  let port = 0;
  let mode: "ok" | "429" | "boom" | "badjson" = "ok";
  beforeAll(async () => {
    server = createServer((_req, res) => {
      if (mode === "429") return void res.writeHead(429, { "content-type": "application/json" }).end(`{"error":"rate limit for ${KEY.slice(0, 0)}"}`);
      if (mode === "boom") return void res.writeHead(500).end("oops");
      if (mode === "badjson") return void res.writeHead(200, { "content-type": "application/json" }).end("{pas du json");
      res.writeHead(200, { "content-type": "application/json", "x-ratelimit-remaining": "1, 9000", "x-ratelimit-limit": "1, 15000" }).end(braveBody(numworksResults((h, p = "/") => `http://${h}:1${p}`)));
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    port = (server.address() as { port: number }).port;
  });
  afterAll(() => new Promise<void>((r) => server.close(() => r())));
  afterEach(() => vi.restoreAllMocks());

  it("événements, lignes provider_requests, messages d'erreur et sortie console : aucune trace de la clé", async () => {
    const spies = [vi.spyOn(console, "info"), vi.spyOn(console, "log"), vi.spyOn(console, "warn"), vi.spyOn(console, "error")].map((s) => s.mockImplementation(() => undefined));
    const provider = createBraveProvider(KEY, `http://127.0.0.1:${port}`, fetch, 2000);
    // gateway avec journal par défaut (console.info) pour vérifier aussi la sortie réelle
    const gateway = new BraveSearchGateway({ db: t.db, provider });
    const r = await requester();
    const captured: string[] = [];
    for (const m of ["ok", "429", "boom", "badjson"] as const) {
      mode = m;
      try {
        await gateway.search(`NumWorks ${m}`, r);
      } catch (e) {
        captured.push(String((e as Error).message), String((e as Error).stack ?? ""));
      }
    }
    const rows = await t.client`select * from provider_requests`;
    expect(rows.length).toBe(4);
    const everything = JSON.stringify(rows) + captured.join("\n") + spies.map((s) => JSON.stringify(s.mock.calls)).join("\n");
    expect(everything).not.toContain(KEY);
    expect(everything).not.toContain(KEY.slice(0, 12));
    expect(spies[0]!.mock.calls.length).toBeGreaterThanOrEqual(4); // le journal a bien écrit
    const logged = spies[0]!.mock.calls.map((c) => JSON.parse(String(c[0])) as Record<string, unknown>);
    expect(logged.every((e) => e.msg === "brave" && typeof e.query === "string" && String(e.query).length === 12)).toBe(true);
    // le texte de la requête n'est jamais journalisé, seulement son empreinte
    expect(JSON.stringify(logged)).not.toContain("NumWorks ok");
  });
});

// ———————————————————————————— Source de découverte + pipeline complet ————————————————————————————

describe("source Brave : recherche utilisateur ≠ appels API ≠ vérifications HTTP", () => {
  const target: ProductTarget = { identity: { brand: "NumWorks", name: "NumWorks Calculatrice graphique N0120", mpn: "N0120", gtin: GTIN }, condition: "new", currency: "EUR", country: "FR" };
  const shop = (host: string, path = "/produit") => `http://${host}:7${path}`;

  it("première requête suffisante : un seul appel API ; sinon la seconde requête, la plus large, est lancée", async () => {
    const many = Array.from({ length: 6 }, (_, i) => item(`https://shop${i}.test/produit`, "NumWorks N0120 calculatrice"));
    const p1 = fakeProvider({ items: many });
    const s1 = new BraveOfferDiscoverySource({ gateway: gw(p1).gateway, requester: await requester() });
    const c1 = await s1.discover({ target, text: "", limit: 40 });
    expect(p1.calls).toHaveLength(1);
    expect(c1).toHaveLength(6);
    expect(s1.stats).toMatchObject({ userSearches: 1, queries: 1, apiCalls: 1, kept: 6 });

    const p2 = fakeProvider({ items: [item("https://a.test/produit", "NumWorks N0120 calculatrice")] });
    const s2 = new BraveOfferDiscoverySource({ gateway: gw(p2).gateway, requester: await requester() });
    await s2.discover({ target, text: "", limit: 40 });
    expect(p2.calls).toHaveLength(2);
    expect(p2.calls[0]).toContain(`"${GTIN}"`);
    expect(p2.calls[1]).toContain(`"N0120"`);
    expect(s2.stats).toMatchObject({ userSearches: 1, queries: 2, apiCalls: 2 });
  });
  it("le même résultat renvoyé par deux requêtes n'est compté qu'une fois", async () => {
    const p = fakeProvider({ items: [item("https://a.test/produit", "NumWorks N0120 calculatrice")] });
    const s = new BraveOfferDiscoverySource({ gateway: gw(p).gateway, requester: await requester() });
    const out = await s.discover({ target, text: "", limit: 40 });
    expect(out).toHaveLength(1);
    expect(s.stats.dropped.duplicate).toBe(1);
  });
  it("quota épuisé : l'erreur typée remonte (le pipeline la consigne), aucune requête de plus", async () => {
    const p = fakeProvider();
    const s = new BraveOfferDiscoverySource({ gateway: gw(p).gateway, requester: await requester({ periodLimit: 0 }) });
    await expect(s.discover({ target, text: "", limit: 10 })).rejects.toBeInstanceOf(BudgetExceededError);
    expect(p.calls).toHaveLength(0);
  });

  describe("pipeline complet : Brave (faux serveur) → découverte → vérification HTTP réelle → comparaison", () => {
    let braveServer: Server;
    let shopServer: Server;
    let bravePort = 0;
    let shopPort = 0;
    const shopHits = new Map<string, number>();
    const braveHits: string[] = [];
    const shops = new Map<string, { status?: number; body: string }>();
    const resolver = async (): Promise<LookupAddress[]> => [{ address: "127.0.0.1", family: 4 }];
    const KEY = "BSA-pipeline-test-key";

    beforeAll(async () => {
      shopServer = createServer((req, res) => {
        const host = (req.headers.host ?? "").split(":")[0]!;
        if (req.url === "/robots.txt") return void res.writeHead(404).end();
        shopHits.set(host, (shopHits.get(host) ?? 0) + 1);
        const s = shops.get(host);
        res.writeHead(s ? (s.status ?? 200) : 404, { "content-type": "text/html; charset=utf-8" }).end(s?.body ?? "");
      });
      await new Promise<void>((r) => shopServer.listen(0, "127.0.0.1", r));
      shopPort = (shopServer.address() as { port: number }).port;
      braveServer = createServer((req, res) => {
        braveHits.push(String(req.url));
        res.writeHead(200, { "content-type": "application/json" }).end(braveBody(numworksResults((h, p = "/") => `http://${h}:${shopPort}${p}`)));
      });
      await new Promise<void>((r) => braveServer.listen(0, "127.0.0.1", r));
      bravePort = (braveServer.address() as { port: number }).port;
      // Les extraits Brave annoncent 49,90 € (A) et 19,99 € (B) ; les VRAIS prix sont ceux des fiches.
      shops.set("boutique-a.test", { body: goodPage({ price: "99.00", gtin: GTIN }) });
      shops.set("boutique-b.test", { body: html({ ld: [ldProduct({ name: "NumWorks N0120 calculatrice", brand: "NumWorks", mpn: "N0120", offers: offer({ price: "129.00", priceCurrency: "EUR", availability: "https://schema.org/InStock", itemCondition: "https://schema.org/NewCondition" }) })] }) });
    });
    afterAll(async () => {
      await new Promise<void>((r) => braveServer.close(() => r()));
      await new Promise<void>((r) => shopServer.close(() => r()));
    });

    it("n'ouvre que les fiches utiles, ignore les prix des extraits, compte recherche / appel API / vérifications séparément", async () => {
      shopHits.clear();
      braveHits.length = 0;
      const provider = createBraveProvider(KEY, `http://127.0.0.1:${bravePort}`, fetch, 3000);
      const { gateway } = gw(provider);
      const source = new BraveOfferDiscoverySource({ gateway, requester: await requester() });
      const verifier = new HttpOfferVerifier({ network: { allowLoopback: true, allowAnyPort: true, resolver }, respectRobots: true, perHostMinGapMs: 0, cacheTtlMs: 0, timeoutMs: 3000 });
      const report = await compareProduct(target, { sources: [source], verifier, limits: { maxVerifications: 12 } });

      // Prix : ceux des fiches (99 € et 129 €), jamais ceux des extraits (49,90 € et 19,99 €).
      expect(report.matches.map((m) => [m.offer.seller.key, m.offer.priceCents]).sort()).toEqual([["boutique-a.test", 9900], ["boutique-b.test", 12900]]);
      expect(report.bestItemPrice.EUR?.offer.priceCents).toBe(9900);
      // Reconditionné : écarté sur le titre ; accessoire, ancien modèle, blog, encyclopédie, recherche, comparateur : jamais ouverts.
      const opened = [...shopHits.keys()].sort();
      expect(opened).toEqual(["boutique-a.test", "boutique-b.test"]);
      expect(source.stats.dropped).toMatchObject({ accessory: 1, different_product: 1, variant: 1, non_merchant_host: 2, not_product_page: 2 });
      // La première requête ne donne que 2 fiches : la seconde est lancée ; ses résultats déjà vus comptent comme doublons.
      expect(source.stats.dropped.duplicate).toBeGreaterThanOrEqual(1);
      // Trois compteurs distincts.
      expect(source.stats.userSearches).toBe(1);
      expect(source.stats.apiCalls).toBe(braveHits.length);
      expect(source.stats.apiCalls).toBe(2);
      expect(verifier.stats.fetches).toBe(2);
      // Traçabilité de bout en bout.
      for (const m of report.matches) expect(m.offer.provenance?.priceSource).toBe("jsonld");
    });
    it("plafond global atteint : le pipeline consigne l'erreur de source, ne contacte aucune boutique et ne plante pas", async () => {
      shopHits.clear();
      await setSetting("budget.brave_monthly_usd", 0);
      const { gateway } = gw(createBraveProvider(KEY, `http://127.0.0.1:${bravePort}`, fetch, 3000));
      const source = new BraveOfferDiscoverySource({ gateway, requester: await requester() });
      const verifier = new HttpOfferVerifier({ network: { allowLoopback: true, allowAnyPort: true, resolver }, respectRobots: false, perHostMinGapMs: 0, cacheTtlMs: 0 });
      const report = await compareProduct(target, { sources: [source], verifier });
      expect(report.sourceErrors).toEqual([{ source: "brave", message: "Plafond mensuel global des appels Brave atteint" }]);
      expect(report.matches).toEqual([]);
      expect(shopHits.size).toBe(0);
      expect(verifier.stats.fetches).toBe(0);
    });
    it("protections SSRF du lot 2 intactes : un résultat Brave pointant vers le réseau interne n'est jamais contacté", async () => {
      const evil = [item("http://169.254.169.254/latest/meta-data/", "NumWorks N0120 calculatrice"), item("http://10.0.0.5/admin", "NumWorks N0120 calculatrice"), item("http://localhost:6379/", "NumWorks N0120 calculatrice")];
      const { gateway } = gw(fakeProvider({ items: evil }));
      const source = new BraveOfferDiscoverySource({ gateway, requester: await requester() });
      const strict = new HttpOfferVerifier({ respectRobots: false, perHostMinGapMs: 0, cacheTtlMs: 0, timeoutMs: 1500 });
      const report = await compareProduct(target, { sources: [source], verifier: strict });
      expect(report.matches).toEqual([]);
      expect(strict.stats.fetches).toBe(0);
      expect(report.unverifiable.every((u) => u.reason === "unsafe_url")).toBe(true);
      expect(report.unverifiable.length).toBe(3);
    });
  });
});
