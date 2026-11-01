import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { LookupAddress } from "node:dns";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { HttpOfferVerifier, type HttpVerifierOptions, type OfferCandidate } from "../src/products";
import { goodPage, html, ldProduct, offer } from "./products-fixtures";

type Handler = (req: IncomingMessage, res: ServerResponse) => void | Promise<void>;
let server: Server;
let port = 0;
const routes = new Map<string, Handler>();
const hits = new Map<string, number>();
let inflight = 0;
let maxInflight = 0;

const PRIVATE_HOSTS = new Set(["interne.test"]);
const resolver = async (host: string): Promise<LookupAddress[]> =>
  PRIVATE_HOSTS.has(host) ? [{ address: "10.0.0.5", family: 4 }] : [{ address: "127.0.0.1", family: 4 }];

const send = (res: ServerResponse, status: number, body: string | Buffer, headers: Record<string, string> = {}) => {
  res.writeHead(status, { "content-type": "text/html; charset=utf-8", ...headers });
  res.end(body);
};
const page = (body: string, status = 200, headers: Record<string, string> = {}): Handler => (_req, res) => send(res, status, body, headers);

beforeAll(async () => {
  server = createServer(async (req, res) => {
    const path = new URL(req.url ?? "/", "http://x").pathname;
    hits.set(path, (hits.get(path) ?? 0) + 1);
    inflight++;
    maxInflight = Math.max(maxInflight, inflight);
    res.on("close", () => inflight--);
    const h = routes.get(path);
    if (!h) return send(res, 404, "<html><title>Introuvable</title></html>");
    await h(req, res);
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  port = (server.address() as { port: number }).port;
});
afterAll(() => new Promise<void>((r) => server.close(() => r())));
beforeEach(() => {
  routes.clear();
  hits.clear();
  inflight = 0;
  maxInflight = 0;
});

const url = (host: string, path: string) => `http://${host}:${port}${path}`;
const cand = (u: string): OfferCandidate => ({ url: u, title: "t", discoveredBy: "test", discoveredAt: new Date() });
const mk = (o: HttpVerifierOptions = {}) =>
  new HttpOfferVerifier({ network: { allowLoopback: true, allowAnyPort: true, resolver }, respectRobots: false, perHostMinGapMs: 0, cacheTtlMs: 0, failureTtlMs: 0, timeoutMs: 2000, ...o });

describe("fiche correcte : données et traçabilité", () => {
  it("renvoie l'offre avec sa provenance (adresse, code HTTP, heure, sources, anomalies, empreinte)", async () => {
    routes.set("/p/1", page(goodPage()));
    const T = new Date("2026-11-01T12:00:00Z");
    const out = await mk({ now: () => T }).verify(cand(url("boutique-a.test", "/p/1?utm_source=x")));
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    const o = out.offer;
    expect(o).toMatchObject({ priceCents: 9900, currency: "EUR", availability: "in_stock", checkedAt: T, shipping: { kind: "unknown" }, shipsToFrance: null });
    expect(o.product).toMatchObject({ brand: "NumWorks", mpn: "N0120", gtin: "04006381333931", condition: "new" });
    expect(o.seller).toEqual({ key: "boutique-a.test", name: "boutique-a.test" });
    expect(o.provenance).toMatchObject({ httpStatus: 200, fetchedAt: T, priceSource: "jsonld", fromCache: false, truncated: false });
    expect(o.provenance?.fetchedUrl).toContain("/p/1");
    expect(o.provenance?.fields.price).toBe("jsonld");
    expect(o.provenance?.dataFingerprint).toMatch(/^[0-9a-f]{64}$/);
  });

  it("page modifiée : l'empreinte des données change avec le prix, pas avec le reste de la page", async () => {
    let price = "99.00";
    let decor = "A";
    routes.set("/p/2", (_q, res) => send(res, 200, goodPage({ price }).replace("</body>", `<p>${decor}</p></body>`)));
    const v = mk();
    const get = async () => {
      const r = await v.verify(cand(url("b.test", "/p/2")));
      if (!r.ok) throw new Error(r.reason);
      return r.offer;
    };
    const a = await get();
    decor = "B";
    const b = await get();
    price = "89.00";
    const c = await get();
    expect(b.provenance?.dataFingerprint).toBe(a.provenance?.dataFingerprint);
    expect(c.provenance?.dataFingerprint).not.toBe(a.provenance?.dataFingerprint);
    expect([a.priceCents, c.priceCents]).toEqual([9900, 8900]);
  });

  it("décode le charset déclaré (ISO-8859-1)", async () => {
    const body = Buffer.from(goodPage({ name: "Téléphone Fairphone 5 écologique" }), "latin1");
    routes.set("/latin", (_q, res) => send(res, 200, body, { "content-type": "text/html; charset=iso-8859-1" }));
    const out = await mk().verify(cand(url("b.test", "/latin")));
    expect(out.ok && out.offer.product.name).toBe("Téléphone Fairphone 5 écologique");
  });

  it("place de marché : le vendeur tiers est identifié séparément du site", async () => {
    const withSeller = ldProduct({ name: "Casque X", offers: { ...offer({ price: "50", priceCurrency: "EUR" }), seller: { "@type": "Organization", name: "Électro Dupont" } } });
    routes.set("/mp", page(html({ ld: [withSeller] })));
    // Le domaine de test n'est pas une place de marché connue : le vendeur reste le site.
    const out = await mk().verify(cand(url("cdiscount.test", "/mp")));
    expect(out.ok && out.offer.seller.key).toBe("cdiscount.test");
  });
});

describe("pages inaccessibles, expirées, bloquées", () => {
  it.each([
    [404, "not_found", false],
    [410, "not_found", false],
    [403, "blocked", true],
    [401, "blocked", true],
    [429, "blocked", true],
    [451, "blocked", false],
    [500, "server_error", true],
    [503, "server_error", true],
    [418, "not_found", false],
  ] as const)("HTTP %s → %s (temporaire : %s) — jamais interprété comme rupture ou baisse de prix", async (status, reason, transient) => {
    routes.set("/s", page("<html><title>x</title></html>", status));
    const out = await mk().verify(cand(url("b.test", "/s")));
    expect(out).toMatchObject({ ok: false, reason, transient, httpStatus: status });
    expect("offer" in out).toBe(false);
  });

  it("délai dépassé → timeout (temporaire)", async () => {
    routes.set("/lent", async () => new Promise(() => undefined)); // ne répond jamais
    const out = await mk({ timeoutMs: 300 }).verify(cand(url("b.test", "/lent")));
    expect(out).toMatchObject({ ok: false, reason: "timeout", transient: true });
  });

  it("serveur injoignable → network_error (temporaire)", async () => {
    const out = await mk({ timeoutMs: 800 }).verify(cand(`http://127.0.0.1:1/x`));
    expect(out).toMatchObject({ ok: false, transient: true });
    expect(["network_error", "timeout"]).toContain((out as { reason: string }).reason);
  });

  it("page de vérification anti-robot servie en 200 → blocked, sans contournement", async () => {
    routes.set("/cf", page(html({ title: "Just a moment...", body: "<h1>Checking your browser</h1>" })));
    expect(await mk().verify(cand(url("b.test", "/cf")))).toMatchObject({ ok: false, reason: "blocked" });
  });

  it("fiche disparue servie en 200, page d'accueil, type de contenu non HTML", async () => {
    routes.set("/gone", page(html({ title: "Page introuvable", body: "<h1>404</h1>" })));
    routes.set("/home", page(html({ title: "Accueil", body: "<h1>Bienvenue</h1>" })));
    routes.set("/pdf", (_q, res) => send(res, 200, "%PDF-1.4", { "content-type": "application/pdf" }));
    const v = mk();
    expect(await v.verify(cand(url("b.test", "/gone")))).toMatchObject({ reason: "not_found" });
    expect(await v.verify(cand(url("b.test", "/home")))).toMatchObject({ reason: "not_a_product_page" });
    expect(await v.verify(cand(url("b.test", "/pdf")))).toMatchObject({ reason: "unsupported_content" });
  });

  it("données contradictoires ou variantes ambiguës → échec explicite, aucun prix retenu", async () => {
    routes.set("/conflict", page(html({ head: `<meta property="product:price:amount" content="70.00"><meta property="product:price:currency" content="EUR">`, ld: [ldProduct({ name: "NumWorks N0120", offers: offer({ price: "99.00", priceCurrency: "EUR" }) })] })));
    const out = await mk().verify(cand(url("b.test", "/conflict")));
    expect(out).toMatchObject({ ok: false, reason: "conflicting_data" });
  });
});

describe("redirections et URL dangereuses (SSRF)", () => {
  it("redirections légitimes suivies, adresse finale et domaine tracés", async () => {
    routes.set("/a", (_q, res) => send(res, 301, "", { location: "/b" }));
    routes.set("/b", (_q, res) => send(res, 302, "", { location: `http://nouvelle-boutique.test:${port}/final` }));
    routes.set("/final", page(goodPage()));
    const out = await mk().verify(cand(url("ancienne-boutique.test", "/a")));
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.offer.provenance?.finalUrl).toBe(url("nouvelle-boutique.test", "/final"));
    expect(out.offer.provenance?.warnings).toContain("redirected_cross_domain");
    expect(out.offer.seller.key).toBe("nouvelle-boutique.test");
  });

  it.each([
    ["métadonnées cloud", "http://169.254.169.254/latest/meta-data/"],
    ["réseau privé (IP)", "http://10.0.0.8/admin"],
    ["réseau privé IPv6 (ULA)", "http://[fd00::1]/"],
    ["schéma fichier", "file:///etc/passwd"],
    ["Redis", "gopher://127.0.0.1:6379/_PING"],
  ])("redirection vers %s → unsafe_url, aucune requête ne part", async (_n, target) => {
    routes.set("/r", (_q, res) => send(res, 302, "", { location: target }));
    const out = await mk().verify(cand(url("b.test", "/r")));
    expect(out).toMatchObject({ ok: false, reason: "unsafe_url", transient: false });
  });

  it("redirection vers un nom qui se résout en adresse privée (DNS) → unsafe_url", async () => {
    routes.set("/r2", (_q, res) => send(res, 302, "", { location: "http://interne.test/" }));
    const out = await mk().verify(cand(url("b.test", "/r2")));
    expect(out).toMatchObject({ ok: false, reason: "unsafe_url" });
  });

  it("boucle de redirections → échec propre", async () => {
    routes.set("/loop", (_q, res) => send(res, 302, "", { location: "/loop" }));
    const out = await mk({ timeoutMs: 3000 }).verify(cand(url("b.test", "/loop")));
    expect(out).toMatchObject({ ok: false, reason: "network_error", transient: false });
    expect(hits.get("/loop")).toBeLessThanOrEqual(6);
  });

  describe("adresses saisies dangereuses, vérificateur de production (aucune option de test)", () => {
    const strict = new HttpOfferVerifier({ respectRobots: false, perHostMinGapMs: 0, cacheTtlMs: 0, timeoutMs: 1500, network: { resolver } });
    it.each([
      "http://169.254.169.254/latest/meta-data/",
      "http://127.0.0.1/",
      "http://localhost/",
      "http://localhost:6379/",
      "http://[::1]/",
      "http://10.1.2.3/",
      "http://192.168.0.1/admin",
      "http://boutique.example:22/",
      "http://user:motdepasse@boutique.example/p",
      "http://intranet.local/p",
      "http://serveur-interne/p",
      "ftp://boutique.example/p",
      "file:///etc/passwd",
      "javascript:alert(1)",
      "pas une adresse",
      `http://boutique.example/${"a".repeat(3000)}`,
    ])("%s → unsafe_url", async (u) => {
      const before = strict.stats.fetches;
      const out = await strict.verify(cand(u.slice(0, 3200)));
      expect(out).toMatchObject({ ok: false, reason: "unsafe_url", transient: false });
      expect(strict.stats.fetches).toBe(before);
    });
    it("nom de domaine public qui se résout en adresse privée → refusé à la connexion", async () => {
      const out = await strict.verify(cand("http://interne.test/p"));
      expect(out).toMatchObject({ ok: false, reason: "unsafe_url" });
    });
  });
});

describe("limites de taille, de politesse et de concurrence", () => {
  it("corps trop volumineux sans produit lisible → too_large ; produit placé avant la limite → accepté et signalé tronqué", async () => {
    routes.set("/enorme", (_q, res) => {
      res.writeHead(200, { "content-type": "text/html" });
      for (let i = 0; i < 40; i++) res.write(Buffer.alloc(64 * 1024, 97));
      res.end();
    });
    routes.set("/enorme-ok", (_q, res) => {
      res.writeHead(200, { "content-type": "text/html" });
      res.write(goodPage());
      for (let i = 0; i < 40; i++) res.write(Buffer.alloc(64 * 1024, 97));
      res.end();
    });
    const v = mk({ maxBytes: 200_000 });
    expect(await v.verify(cand(url("b.test", "/enorme")))).toMatchObject({ ok: false, reason: "too_large" });
    const ok = await v.verify(cand(url("b.test", "/enorme-ok")));
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.offer.provenance?.truncated).toBe(true);
      expect(ok.offer.provenance?.warnings).toContain("body_truncated");
    }
  });

  it("robots.txt respecté : chemin interdit jamais requêté ; robots.txt inaccessible = prudence", async () => {
    routes.set("/robots.txt", page("User-agent: *\nDisallow: /prive\n", 200, { "content-type": "text/plain" }));
    routes.set("/prive/p", page(goodPage()));
    routes.set("/public/p", page(goodPage()));
    const v = mk({ respectRobots: true });
    expect(await v.verify(cand(url("robots-a.test", "/prive/p")))).toMatchObject({ ok: false, reason: "robots_disallowed" });
    expect(hits.get("/prive/p")).toBeUndefined();
    expect((await v.verify(cand(url("robots-a.test", "/public/p")))).ok).toBe(true);
    routes.set("/robots.txt", page("erreur", 500, { "content-type": "text/plain" }));
    expect(await v.verify(cand(url("robots-b.test", "/public/p")))).toMatchObject({ ok: false, reason: "robots_disallowed" });
  });

  it("concurrence globale bornée", async () => {
    routes.set("/slow", async (_q, res) => {
      await new Promise((r) => setTimeout(r, 60));
      send(res, 200, goodPage());
    });
    const urls = Array.from({ length: 8 }, (_, i) => url(`site${i}.test`, "/slow"));
    maxInflight = 0;
    const limited = mk({ maxConcurrent: 2 });
    const r1 = await Promise.all(urls.map((u) => limited.verify(cand(u))));
    expect(r1.every((r) => r.ok)).toBe(true);
    expect(maxInflight).toBeLessThanOrEqual(2);
    maxInflight = 0;
    await Promise.all(urls.map((u) => mk({ maxConcurrent: 8 }).verify(cand(u))));
    expect(maxInflight).toBeGreaterThan(2); // le plafond est bien ce qui limite
  });

  it("espacement minimal par site ; au-delà de l'attente maximale → rate_limited (temporaire)", async () => {
    for (const i of [1, 2, 3]) routes.set(`/m${i}`, page(goodPage()));
    const v = mk({ perHostMinGapMs: 120, maxHostWaitMs: 5000 });
    const t0 = Date.now();
    const r = await Promise.all([1, 2, 3].map((i) => v.verify(cand(url("meme-site.test", `/m${i}`)))));
    expect(r.every((x) => x.ok)).toBe(true);
    expect(Date.now() - t0).toBeGreaterThanOrEqual(220);
    const impatient = mk({ perHostMinGapMs: 800, maxHostWaitMs: 50 });
    const r2 = await Promise.all([1, 2, 3].map((i) => impatient.verify(cand(url("autre-site.test", `/m${i}`)))));
    expect(r2.filter((x) => !x.ok && x.reason === "rate_limited").length).toBeGreaterThanOrEqual(1);
    expect(r2.filter((x) => !x.ok && x.reason === "rate_limited").every((x) => !x.ok && x.transient)).toBe(true);
  });
});

describe("cache, fusion des requêtes et honnêteté de l'âge", () => {
  it("un second contrôle dans la durée de validité n'ouvre pas la fiche et garde l'heure d'origine", async () => {
    routes.set("/c", page(goodPage()));
    let clock = new Date("2026-11-01T12:00:00Z");
    const v = mk({ cacheTtlMs: 60_000, now: () => clock });
    const a = await v.verify(cand(url("b.test", "/c")));
    clock = new Date("2026-11-01T12:00:30Z");
    const b = await v.verify(cand(url("b.test", "/c?utm_source=autre")));
    expect(hits.get("/c")).toBe(1);
    expect(v.stats).toMatchObject({ fetches: 1, cacheHits: 1 });
    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) {
      expect(b.offer.checkedAt).toEqual(a.offer.checkedAt);
      expect(a.offer.provenance?.fromCache).toBe(false);
      expect(b.offer.provenance?.fromCache).toBe(true);
    }
  });

  it("requêtes simultanées pour la même fiche : une seule requête réseau", async () => {
    routes.set("/s1", async (_q, res) => {
      await new Promise((r) => setTimeout(r, 80));
      send(res, 200, goodPage());
    });
    const v = mk({ cacheTtlMs: 0 });
    const r = await Promise.all(Array.from({ length: 5 }, () => v.verify(cand(url("b.test", "/s1")))));
    expect(r.every((x) => x.ok)).toBe(true);
    expect(hits.get("/s1")).toBe(1);
    expect(v.stats.mergedRequests).toBe(4);
  });

  it("un échec est mémorisé brièvement (pas de martèlement), puis réessayé", async () => {
    routes.set("/f", page("x", 403));
    const v = mk({ cacheTtlMs: 60_000, failureTtlMs: 150 });
    await v.verify(cand(url("b.test", "/f")));
    await v.verify(cand(url("b.test", "/f")));
    expect(hits.get("/f")).toBe(1);
    await new Promise((r) => setTimeout(r, 200));
    routes.set("/f", page(goodPage()));
    expect((await v.verify(cand(url("b.test", "/f")))).ok).toBe(true);
  });
});
