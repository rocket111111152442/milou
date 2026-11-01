import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createBraveProvider, SearchProviderError } from "../src/search/brave";
import { buildProductQueries, gtinForQuery, MAX_QUERY_CHARS, MAX_QUERY_WORDS, prefilterResults, type ProductTarget } from "../src/products";
import { braveBody, numworksResults } from "./brave-fixtures";

const GTIN = "4006381333931";
const target: ProductTarget = { identity: { brand: "NumWorks", name: "NumWorks Calculatrice graphique N0120", mpn: "N0120", gtin: GTIN }, condition: "new", currency: "EUR", country: "FR" };

describe("requêtes précises à partir de l'identité du produit", () => {
  it("code-barres d'abord, puis référence : guillemets (expression exacte) et exclusions des accessoires", () => {
    const q = buildProductQueries(target);
    expect(q).toHaveLength(2);
    expect(q[0]).toBe(`"${GTIN}" NumWorks -coque -étui -housse -protection -film`);
    expect(q[1]).toBe(`"N0120" NumWorks neuf -coque -étui -housse -protection -film`);
  });
  it("sans identifiant : une seule requête par le nom, condition incluse", () => {
    const q = buildProductQueries({ ...target, identity: { brand: "Apple", name: "Apple iPhone 15 128 Go" } });
    expect(q).toEqual(["Apple iPhone 15 128 Go neuf -coque -étui -housse -protection -film"]);
    expect(buildProductQueries({ ...target, condition: "refurbished", identity: { name: "iPhone 15" } })[0]).toContain("reconditionné");
  });
  it("une seule requête avec maxQueries = 1 ; jamais plus de 3 ; rien sans nom exploitable", () => {
    expect(buildProductQueries(target, { maxQueries: 1 })).toHaveLength(1);
    expect(buildProductQueries(target, { maxQueries: 99 }).length).toBeLessThanOrEqual(3);
    expect(buildProductQueries({ ...target, identity: { name: "   " } })).toEqual([]);
  });
  it("un accessoire recherché n'exclut pas les accessoires", () => {
    const q = buildProductQueries({ ...target, identity: { name: "Coque pour iPhone 15" } });
    expect(q[0]).not.toContain("-coque");
  });
  it("un GTIN invalide n'est jamais utilisé ; l'identifiant garde sa forme saisie", () => {
    expect(gtinForQuery("4006381333932")).toBeNull();
    expect(gtinForQuery("4006 3813 33931")).toBe(GTIN);
    expect(buildProductQueries({ ...target, identity: { ...target.identity, gtin: "1234567890123" } })[0]).toContain("N0120");
  });
  it("assainit les guillemets, caractères de contrôle et opérateurs injectés ; respecte les limites de taille", () => {
    const hostile = { ...target, identity: { brand: 'Num"Works', name: `iPhone\n15 site:evil.example "x" ${"mot ".repeat(200)}`, mpn: 'N"0120' } };
    for (const q of buildProductQueries(hostile)) {
      expect(q).not.toMatch(/[\n\r\u0000]/);
      expect(q.length).toBeLessThanOrEqual(MAX_QUERY_CHARS);
      expect(q.split(" ").length).toBeLessThanOrEqual(MAX_QUERY_WORDS);
      expect((q.match(/"/g) ?? []).length % 2).toBe(0);
    }
  });
});

describe("filtrage des résultats avant toute vérification", () => {
  const shop = (host: string, path = "/") => `http://${host}:4000${path}`;
  const out = prefilterResults(target, numworksResults(shop).map((r) => ({ url: r.url, title: r.title, description: r.description ?? "", age: null, publishedAt: null, hostname: new URL(r.url).hostname })), { now: new Date("2026-11-01T12:00:00Z") });
  it("garde les fiches du produit et seulement elles, sans doublon", () => {
    expect(out.kept.map((k) => new URL(k.candidate.url).hostname).sort()).toEqual(["boutique-a.test", "boutique-b.test"]);
  });
  it("écarte avec un motif : doublon, accessoire, ancien modèle, reconditionné, blog/test, encyclopédie, recherche, comparateur", () => {
    const reasons = Object.fromEntries(out.dropped.map((d) => [new URL(d.url).hostname, d.reason]));
    expect(reasons["boutique-g.test"]).toBe("accessory");
    expect(reasons["boutique-h.test"]).toBe("different_product");
    expect(reasons["boutique-c.test"]).toBe("variant");
    expect(reasons["blog-hightech.test"]).toBe("not_product_page");
    expect(reasons["fr.wikipedia.org"]).toBe("non_merchant_host");
    expect(reasons["boutique-z.test"]).toBe("not_product_page");
    expect(reasons["www.idealo.fr"]).toBe("non_merchant_host");
    expect(out.dropped.filter((d) => d.reason === "duplicate")).toHaveLength(1);
  });
  it("un extrait contenant un prix ne produit jamais de prix : le candidat n'a pas de champ de prix", () => {
    for (const k of out.kept) {
      expect(Object.keys(k.candidate).sort()).toEqual(["discoveredAt", "discoveredBy", "snippet", "title", "url"]);
      expect(JSON.stringify(Object.keys(k.candidate))).not.toMatch(/price|prix|cents/i);
    }
    expect(out.kept.find((k) => k.candidate.snippet?.includes("49,90"))?.candidate.snippet).toContain("49,90"); // texte conservé, mais jamais interprété
  });
  it("adresses dangereuses ou invalides écartées dès ce stade", () => {
    const items = ["javascript:alert(1)", "ftp://x.test/a", "http://user:pw@boutique.test/p", "pas une url", `http://boutique.test/${"a".repeat(3000)}`].map((url) => ({ url, title: "NumWorks N0120", description: "", age: null, publishedAt: null, hostname: "x" }));
    const r = prefilterResults(target, items, { now: new Date() });
    expect(r.kept).toEqual([]);
    expect(r.dropped.every((d) => d.reason === "invalid_url")).toBe(true);
  });
  it("un titre vague reste candidat mais passe après les titres précis", () => {
    const r = prefilterResults(
      target,
      [
        { url: "https://vague.test/produit", title: "Calculatrice graphique lycée", description: "", age: null, publishedAt: null, hostname: "vague.test" },
        { url: "https://precis.test/produit", title: "NumWorks N0120 calculatrice", description: "", age: null, publishedAt: null, hostname: "precis.test" },
      ],
      { now: new Date() },
    );
    expect(r.kept.map((k) => new URL(k.candidate.url).hostname)).toEqual(["precis.test", "vague.test"]);
  });
});

describe("client Brave : contrat HTTP contre un faux serveur Brave (aucun appel réel)", () => {
  let server: Server;
  let port = 0;
  let last: { url: URL; headers: IncomingMessage["headers"] } | null = null;
  let respond: (res: ServerResponse) => void = (res) => res.end();
  beforeAll(async () => {
    server = createServer((req, res) => {
      last = { url: new URL(req.url ?? "/", "http://x"), headers: req.headers };
      respond(res);
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    port = (server.address() as { port: number }).port;
  });
  afterAll(() => new Promise<void>((r) => server.close(() => r())));
  beforeEach(() => {
    last = null;
  });
  const KEY = "BSA-clé-secrète-de-test-123456";
  const provider = (timeoutMs = 3000) => createBraveProvider(KEY, `http://127.0.0.1:${port}`, fetch, timeoutMs);
  const json = (status: number, body: string, headers: Record<string, string> = {}) => (res: ServerResponse) => {
    res.writeHead(status, { "content-type": "application/json", ...headers });
    res.end(body);
  };

  it("émet la requête attendue : jeton en en-tête (jamais dans l'URL), q, count plafonné, pays et langue", async () => {
    respond = json(200, braveBody(numworksResults((h, p = "/") => `http://${h}:1${p}`)));
    const items = await provider().search("NumWorks N0120", { count: 99 });
    expect(last!.headers["x-subscription-token"]).toBe(KEY);
    expect(last!.url.href).not.toContain(KEY);
    expect(last!.url.pathname).toBe("/res/v1/web/search");
    expect(last!.url.searchParams.get("q")).toBe("NumWorks N0120");
    expect(last!.url.searchParams.get("count")).toBe("20");
    expect(last!.url.searchParams.get("country")).toBe("FR");
    expect(items.length).toBeGreaterThan(5);
    expect(items[0]).toMatchObject({ url: expect.stringContaining("boutique-a.test"), hostname: "boutique-a.test" });
  });
  it("lit les en-têtes de quota du fournisseur", async () => {
    respond = json(200, braveBody([]), { "x-ratelimit-remaining": "1, 14990", "x-ratelimit-limit": "1, 15000" });
    let meta: { quotaRemaining: number | null; quotaLimit: number | null } | null = null;
    await provider().search("x", { onResponse: (m) => (meta = m) });
    expect(meta).toMatchObject({ quotaRemaining: 14990, quotaLimit: 15000 });
  });
  it.each([
    [429, true],
    [500, true],
    [503, true],
    [401, false],
    [403, false],
    [422, false],
  ])("HTTP %s → SearchProviderError (réessayable : %s), message sans clé", async (status, retryable) => {
    respond = json(status, '{"error":"x"}');
    const err = await provider().search("x").then(() => null, (e: unknown) => e as SearchProviderError);
    expect(err).toBeInstanceOf(SearchProviderError);
    expect(err!.retryable).toBe(retryable);
    expect(err!.status).toBe(status);
    expect(err!.message).not.toContain(KEY);
  });
  it.each([
    ["JSON invalide", "pas du json{"],
    ["forme inattendue (web.results n'est pas une liste)", '{"web":{"results":"oups"}}'],
    ["racine non objet", "[1,2,3]"],
    ["null", "null"],
  ])("réponse mal formée (%s) → échec non réessayable, jamais d'exception brute", async (_n, body) => {
    respond = json(200, body);
    const err = await provider().search("x").then(() => null, (e: unknown) => e);
    expect(err).toBeInstanceOf(SearchProviderError);
    expect((err as SearchProviderError).retryable).toBe(false);
  });
  it("réponse sans résultats → liste vide ; entrées invalides ignorées (URL non http, trop longue, absente)", async () => {
    respond = json(200, JSON.stringify({ web: { results: [{ url: "ftp://x.test/a", title: "a" }, { title: "sans url" }, { url: `https://x.test/${"a".repeat(3000)}`, title: "longue" }, { url: "https://ok.test/p", title: "<b>ok</b> &amp; co" }] } }));
    const items = await provider().search("x");
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ url: "https://ok.test/p", title: "ok & co" });
    respond = json(200, "{}");
    expect(await provider().search("x")).toEqual([]);
  });
  it("délai dépassé → erreur de délai (aucune relance automatique)", async () => {
    let hits = 0;
    respond = () => {
      hits++; // ne répond jamais
    };
    const err = await provider(300).search("x").then(() => null, (e: unknown) => e as Error);
    expect(err).not.toBeNull();
    expect(["TimeoutError", "AbortError"]).toContain(err!.name);
    expect(hits).toBe(1);
  });
});
