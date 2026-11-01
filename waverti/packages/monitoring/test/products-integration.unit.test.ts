/**
 * Intégration : découverte (simulée, aucun crédit Brave) → vérificateur HTTP réel (boutiques locales) →
 * moteur de rapprochement du lot 1 → rapport. Les boutiques sont des serveurs HTTP locaux ; aucun site tiers.
 */
import { createServer, type Server } from "node:http";
import type { LookupAddress } from "node:dns";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { compareProduct, HttpOfferVerifier, type OfferCandidate, type OfferDiscoverySource, type ProductTarget } from "../src/products";
import { goodPage, GTIN, html, ldProduct, offer, schema, shippingFR } from "./products-fixtures";

let server: Server;
let port = 0;
const shops = new Map<string, { status?: number; body: string }>();
const hitsByHost = new Map<string, number>();
const resolver = async (): Promise<LookupAddress[]> => [{ address: "127.0.0.1", family: 4 }];

beforeAll(async () => {
  server = createServer((req, res) => {
    const host = (req.headers.host ?? "").split(":")[0]!;
    if (new URL(req.url ?? "/", "http://x").pathname === "/robots.txt") {
      res.writeHead(404);
      return void res.end();
    }
    hitsByHost.set(host, (hitsByHost.get(host) ?? 0) + 1);
    const shop = shops.get(host);
    res.writeHead(shop ? (shop.status ?? 200) : 404, { "content-type": "text/html; charset=utf-8" });
    res.end(shop?.body ?? "<html><title>Introuvable</title></html>");
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  port = (server.address() as { port: number }).port;

  shops.set("boutique-a.test", { body: goodPage({ price: "99.00", shipping: shippingFR(0) }) });
  // B : microdonnées seulement (pas de JSON-LD), MPN identique, en rupture, frais inconnus.
  shops.set("boutique-b.test", {
    body: html({
      body: `<div itemscope itemtype="https://schema.org/Product"><h1 itemprop="name">NumWorks N0120 calculatrice</h1><span itemprop="brand">NumWorks</span><span itemprop="mpn">N0120</span>
        <div itemprop="offers" itemscope><meta itemprop="priceCurrency" content="EUR"><span itemprop="price" content="89.00">89,00 €</span><link itemprop="availability" href="https://schema.org/OutOfStock"><link itemprop="itemCondition" href="https://schema.org/NewCondition"></div></div>`,
    }),
  });
  shops.set("boutique-c.test", { body: goodPage({ price: "59.00", condition: "RefurbishedCondition" }) });
  shops.set("boutique-d.test", { body: goodPage({ price: "80.00", currency: "GBP" }) });
  shops.set("boutique-e.test", {
    body: html({ head: `<meta property="product:price:amount" content="50.00"><meta property="product:price:currency" content="EUR">`, ld: [ldProduct({ name: "Calculatrice NumWorks N0120", gtin13: GTIN, offers: offer({ price: "99.00", priceCurrency: "EUR" }) })] }),
  });
  shops.set("boutique-f.test", { status: 403, body: "<html><title>Accès refusé</title></html>" });
  shops.set("boutique-g.test", { body: html({ ld: [ldProduct({ name: "Coque de protection pour calculatrice NumWorks", offers: offer({ price: "12.00", priceCurrency: "EUR" }) })] }) });
  shops.set("boutique-h.test", { body: html({ ld: [ldProduct({ name: "NumWorks N0110 ancien modèle", brand: "NumWorks", offers: offer({ price: "59.00", priceCurrency: "EUR" }) })] }) });
  // I : titre vague côté fiche (aucune référence) → non déterminé.
  shops.set("boutique-i.test", { body: html({ ld: [ldProduct({ name: "Calculatrice graphique lycée", offers: offer({ price: "70.00", priceCurrency: "EUR", itemCondition: schema("NewCondition") }) })] }) });
  // J : même produit, seconde fiche du même vendeur A, moins chère.
  shops.set("boutique-j.test", { body: goodPage({ price: "95.00", shipping: shippingFR(5.9) }) });
});
afterAll(() => new Promise<void>((r) => server.close(() => r())));

const target: ProductTarget = {
  identity: { brand: "NumWorks", name: "Calculatrice graphique NumWorks N0120", mpn: "N0120", gtin: GTIN },
  condition: "new",
  currency: "EUR",
  country: "FR",
};

/** Simule le moteur de recherche (aucun crédit Brave) : renvoie des résultats avec seulement un titre et une adresse. */
function staticDiscovery(entries: Array<{ host: string; title: string; snippet?: string }>): OfferDiscoverySource {
  return {
    name: "recherche-simulee",
    async discover(): Promise<OfferCandidate[]> {
      return entries.map((e) => ({ url: `http://${e.host}:${port}/produit`, title: e.title, snippet: e.snippet, discoveredBy: "recherche-simulee", discoveredAt: new Date() }));
    },
  };
}
const verifier = (o = {}) => new HttpOfferVerifier({ network: { allowLoopback: true, allowAnyPort: true, resolver }, respectRobots: true, perHostMinGapMs: 0, cacheTtlMs: 0, failureTtlMs: 0, timeoutMs: 2000, ...o });

const ALL = [
  { host: "boutique-a.test", title: "Calculatrice NumWorks N0120 - neuf" },
  { host: "boutique-b.test", title: "NumWorks N0120 calculatrice" },
  { host: "boutique-c.test", title: "Calculatrice NumWorks N0120" },
  { host: "boutique-d.test", title: "NumWorks N0120 calculator" },
  { host: "boutique-e.test", title: "Calculatrice NumWorks N0120" },
  { host: "boutique-f.test", title: "Calculatrice NumWorks N0120 lycée" },
  { host: "boutique-g.test", title: "Coque de protection pour calculatrice NumWorks N0120" },
  { host: "boutique-h.test", title: "NumWorks N0110 ancien modèle" },
  { host: "boutique-i.test", title: "Calculatrice graphique lycée NumWorks" },
  { host: "boutique-j.test", title: "NumWorks N0120 calculatrice lycée" },
];

describe("vérificateur HTTP + moteur de rapprochement (lot 1)", () => {
  const NOW = () => new Date();

  it("classe chaque boutique correctement, sans mélanger ni inventer", async () => {
    hitsByHost.clear();
    const report = await compareProduct(target, { sources: [staticDiscovery(ALL)], verifier: verifier(), limits: { maxVerifications: 20 }, now: NOW });
    const sellers = (xs: Array<{ offer: { seller: { key: string } } }>) => xs.map((x) => x.offer.seller.key).sort();

    // Même produit, vérifié, éligible : A (GTIN), B (MPN, en rupture), J (GTIN).
    expect(sellers(report.matches)).toEqual(["boutique-a.test", "boutique-b.test", "boutique-j.test"]);
    expect(report.matches.map((m) => m.match.verdict).sort()).toEqual(["exact", "exact", "exact"]);
    // Reconditionné : une variante, jamais un prix « neuf ».
    expect(sellers(report.variants)).toEqual(["boutique-c.test"]);
    // Livre sterling : conservée à part, jamais convertie.
    expect(report.ineligible.map((i) => [i.offer.seller.key, i.reasons])).toEqual([["boutique-d.test", ["currency"]]]);
    // Contradictoire / bloquée : non vérifiables, motif connu, aucun prix.
    expect(report.unverifiable.map((u) => [new URL(u.url).hostname, u.reason]).sort()).toEqual([
      ["boutique-e.test", "conflicting_data"],
      ["boutique-f.test", "blocked"],
    ]);
    // Accessoire et ancien modèle écartés sur le titre : leur fiche n'est jamais ouverte.
    expect(hitsByHost.get("boutique-g.test")).toBeUndefined();
    expect(hitsByHost.get("boutique-h.test")).toBeUndefined();
    expect(report.rejected.map((r) => new URL(r.url).hostname).sort()).toEqual(["boutique-g.test", "boutique-h.test"]);
    // Fiche sans référence ni modèle : « non déterminée », pas dans les offres.
    expect(report.uncertain.map((u) => [new URL(u.url).hostname, u.reason])).toContainEqual(["boutique-i.test", "inconclusive"]);
    expect(report.matches.some((m) => m.offer.seller.key === "boutique-i.test")).toBe(false);
  });

  it("prix : meilleur prix article ≠ meilleur prix livré quand des frais sont inconnus", async () => {
    const report = await compareProduct(target, { sources: [staticDiscovery(ALL)], verifier: verifier(), limits: { maxVerifications: 20 }, now: NOW });
    // B est la moins chère (89 €) mais en rupture ET frais inconnus ; le classement par prix ne regarde que le prix article.
    expect(report.bestItemPrice.EUR?.offer.seller.key).toBe("boutique-b.test");
    const b = report.matches.find((m) => m.offer.seller.key === "boutique-b.test")!;
    expect(b.offer.availability).toBe("out_of_stock");
    expect(b.landedPriceCents).toBeNull();
    // Meilleur prix livré : seulement parmi les frais connus → A (99 € livraison gratuite) contre J (95 + 5,90 = 100,90 €).
    expect(report.bestLandedPrice.EUR?.offer.seller.key).toBe("boutique-a.test");
    expect(report.bestLandedPrice.EUR?.landedPriceCents).toBe(9900);
    expect(report.matches.find((m) => m.offer.seller.key === "boutique-j.test")?.landedPriceCents).toBe(10090);
  });

  it("chaque offre retenue porte sa traçabilité (source, heure, adresse) ; le texte visible n'est jamais utilisé ici", async () => {
    const report = await compareProduct(target, { sources: [staticDiscovery(ALL)], verifier: verifier(), limits: { maxVerifications: 20 }, now: NOW });
    for (const m of report.matches) {
      expect(m.offer.provenance).toBeDefined();
      expect(m.offer.provenance!.fetchedAt).toBeInstanceOf(Date);
      expect(m.offer.provenance!.httpStatus).toBe(200);
      expect(["jsonld", "microdata", "meta"]).toContain(m.offer.provenance!.priceSource);
    }
    expect(report.matches.find((m) => m.offer.seller.key === "boutique-b.test")?.offer.provenance?.priceSource).toBe("microdata");
    expect(report.matches.find((m) => m.offer.seller.key === "boutique-a.test")?.offer.provenance?.fields.shipping).toBe("jsonld");
  });

  it("une offre trop ancienne n'est plus présentée comme actuelle : listée « stale », exclue des meilleurs prix", async () => {
    const v = verifier();
    const first = await compareProduct(target, { sources: [staticDiscovery(ALL.slice(0, 2))], verifier: v, now: NOW });
    expect(first.bestItemPrice.EUR).toBeDefined();
    // Trois jours plus tard, avec des vérifications d'origine inchangées : tout est périmé.
    const later = () => new Date(Date.now() + 3 * 24 * 3600_000);
    const stale = await compareProduct(target, { sources: [staticDiscovery(ALL.slice(0, 2))], verifier: verifier({ cacheTtlMs: 0 }), limits: { maxOfferAgeMs: 1000 }, now: later });
    expect(stale.matches.length).toBeGreaterThan(0);
    expect(stale.matches.every((m) => m.stale)).toBe(true);
    expect(stale.bestItemPrice).toEqual({});
    expect(stale.bestLandedPrice).toEqual({});
  });

  it("budget de vérifications respecté : les fiches non ouvertes sont signalées, aucune n'est devinée", async () => {
    hitsByHost.clear();
    const report = await compareProduct(target, { sources: [staticDiscovery(ALL)], verifier: verifier(), limits: { maxVerifications: 3, concurrency: 2 }, now: NOW });
    const opened = [...hitsByHost.values()].reduce((a, b) => a + b, 0);
    expect(opened).toBeLessThanOrEqual(3);
    expect(report.stats.budgetExhausted).toBe(true);
    expect(report.uncertain.filter((u) => u.reason === "budget").length).toBeGreaterThan(0);
  });

  it("une page qui change entre deux contrôles : le nouveau prix est lu, l'empreinte change", async () => {
    shops.set("boutique-k.test", { body: goodPage({ price: "99.00" }) });
    const entries = [{ host: "boutique-k.test", title: "Calculatrice NumWorks N0120" }];
    const v = verifier();
    const a = await compareProduct(target, { sources: [staticDiscovery(entries)], verifier: v, now: NOW });
    shops.set("boutique-k.test", { body: goodPage({ price: "84.00" }) });
    const b = await compareProduct(target, { sources: [staticDiscovery(entries)], verifier: v, now: NOW });
    expect(a.matches[0]!.offer.priceCents).toBe(9900);
    expect(b.matches[0]!.offer.priceCents).toBe(8400);
    expect(b.matches[0]!.offer.provenance!.dataFingerprint).not.toBe(a.matches[0]!.offer.provenance!.dataFingerprint);
  });

  it("variantes d'un même modèle chez un marchand : la bonne capacité est retenue via l'adresse", async () => {
    const phone: ProductTarget = { identity: { brand: "Apple", name: "Apple iPhone 15 256 Go bleu" }, condition: "new", currency: "EUR", country: "FR" };
    const group = {
      "@context": "https://schema.org",
      "@type": "ProductGroup",
      name: "Apple iPhone 15",
      brand: { "@type": "Brand", name: "Apple" },
      hasVariant: [
        { "@type": "Product", name: "Apple iPhone 15 128 Go noir", sku: "IP15-128", offers: offer({ price: "799", priceCurrency: "EUR", availability: schema("InStock"), itemCondition: schema("NewCondition") }) },
        { "@type": "Product", name: "Apple iPhone 15 256 Go bleu", sku: "IP15-256", offers: offer({ price: "899", priceCurrency: "EUR", availability: schema("InStock"), itemCondition: schema("NewCondition") }) },
      ],
    };
    shops.set("boutique-l.test", { body: html({ ld: [group] }) });
    const withVariant = (u: string) => ({
      name: "recherche-simulee",
      async discover(): Promise<OfferCandidate[]> {
        return [{ url: u, title: "Apple iPhone 15 256 Go bleu", discoveredBy: "recherche-simulee", discoveredAt: new Date() }];
      },
    });
    const good = await compareProduct(phone, { sources: [withVariant(`http://boutique-l.test:${port}/iphone-15?variant=IP15-256`)], verifier: verifier(), now: NOW });
    expect(good.matches[0]?.offer.priceCents).toBe(89900);
    expect(good.matches[0]?.match.verdict).toBe("probable");
    const ambiguous = await compareProduct(phone, { sources: [withVariant(`http://boutique-l.test:${port}/iphone-15`)], verifier: verifier(), now: NOW });
    expect(ambiguous.matches).toHaveLength(0);
    expect(ambiguous.unverifiable[0]).toMatchObject({ reason: "ambiguous_variant" });
  });
});
