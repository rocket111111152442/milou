import { describe, expect, it } from "vitest";
import {
  buildSearchText,
  compareProduct,
  createSimulatedWeb,
  dedupeCandidates,
  landedPrice,
  type ProductTarget,
  type SimulatedPage,
  type VerifiedOffer,
} from "../src/products";

const NOW = new Date("2026-11-01T12:00:00Z");
const GTIN = "4006381333931";

const target: ProductTarget = {
  identity: { brand: "NumWorks", name: "Calculatrice graphique NumWorks N0120", mpn: "N0120", gtin: GTIN },
  condition: "new",
  currency: "EUR",
  country: "FR",
};

type PageOpts = Partial<Omit<VerifiedOffer, "product">> & { product?: Partial<VerifiedOffer["product"]> };
function page(host: string, title: string, o: PageOpts = {}, snippet?: string): SimulatedPage {
  return {
    url: `https://${host}/produit/${encodeURIComponent(title)}?utm_source=moteur`,
    title,
    snippet,
    page: {
      seller: { key: host, name: host },
      product: { name: title, brand: "NumWorks", ...o.product },
      priceCents: o.priceCents ?? 8900,
      currency: o.currency ?? "EUR",
      availability: o.availability ?? "in_stock",
      shipping: o.shipping ?? { kind: "unknown" },
      shipsToFrance: o.shipsToFrance ?? true,
      checkedAt: o.checkedAt,
    },
  };
}
const run = (pages: SimulatedPage[], limits = {}, t: ProductTarget = target, extra: { failDiscovery?: boolean } = {}) => {
  const web = createSimulatedWeb(pages, { now: () => NOW, ...extra });
  return { web, report: compareProduct(t, { sources: [web.source], verifier: web.verifier, limits, now: () => NOW }) };
};

describe("pipeline de comparaison (sources simulées)", () => {
  it("le même produit chez plusieurs marchands est regroupé, trié par prix, avec les frais inconnus signalés", async () => {
    const { report: p } = run([
      page("electroplanet.example", "NumWorks calculatrice graphique N0120 Noire", { product: { gtin: GTIN, mpn: "N0120", condition: "new" }, priceCents: 9900, shipping: { kind: "known", cents: 490 } }),
      page("megashop.example", "Calculatrice NumWorks N0120 - neuf", { product: { gtin: GTIN, condition: "new" }, priceCents: 8900, shipping: { kind: "unknown" } }),
      page("papeterie-lyon.example", "NumWorks N0120 calculatrice lycée", { product: { gtin: GTIN, condition: "new" }, priceCents: 9500, shipping: { kind: "free" } }),
    ]);
    const r = await p;
    expect(r.matches.map((m) => m.offer.seller.key)).toEqual(["megashop.example", "papeterie-lyon.example", "electroplanet.example"]);
    expect(r.matches.every((m) => m.match.verdict === "exact")).toBe(true);
    // Meilleur prix article : MegaShop ; mais ses frais sont inconnus, donc il n'est PAS le « meilleur prix livré ».
    expect(r.bestItemPrice.EUR?.offer.seller.key).toBe("megashop.example");
    expect(r.bestLandedPrice.EUR?.offer.seller.key).toBe("papeterie-lyon.example");
    expect(r.matches.find((m) => m.offer.seller.key === "megashop.example")?.landedPriceCents).toBeNull();
    expect(r.matches.find((m) => m.offer.seller.key === "electroplanet.example")?.landedPriceCents).toBe(10390);
    expect(r.stats).toMatchObject({ unique: 3, verified: 3, budgetExhausted: false });
  });

  it("écarte les accessoires, les autres modèles et les autres générations avant même d'ouvrir leur fiche", async () => {
    const { web, report } = run([
      page("a.example", "NumWorks N0120 calculatrice", { product: { gtin: GTIN, condition: "new" } }),
      page("b.example", "Coque de protection pour calculatrice NumWorks N0120", { priceCents: 1200 }),
      page("c.example", "Calculatrice NumWorks N0110 (ancien modèle)", { priceCents: 5900 }),
      page("d.example", "Housse pour calculatrice graphique NumWorks", { priceCents: 1500 }),
      page("e.example", "Casio fx-92 calculatrice collège", { product: { brand: "Casio" }, priceCents: 1800 }),
    ]);
    const r = await report;
    expect(r.matches.map((m) => m.offer.seller.key)).toEqual(["a.example"]);
    const rejected = Object.fromEntries(r.rejected.map((x) => [new URL(x.url).hostname, x.match.reasons]));
    expect(rejected["b.example"]).toContain("accessory");
    expect(rejected["d.example"]).toContain("accessory");
    expect(rejected["c.example"]).toContain("model_differs");
    // Aucune fiche rejetée au titre n'a été ouverte : budget économisé.
    expect(web.verifiedUrls.filter((u) => /b\.example|c\.example|d\.example|e\.example/.test(u))).toEqual([]);
  });

  it("sépare les variantes : état reconditionné/occasion, lot, couleur différente — jamais mélangés aux offres neuves", async () => {
    const t: ProductTarget = { identity: { brand: "Apple", name: "Apple iPhone 15 128 Go noir" }, condition: "new", currency: "EUR", country: "FR" };
    const mk = (host: string, title: string, product: Partial<VerifiedOffer["product"]>, price: number, snippet?: string) =>
      page(host, title, { product: { brand: "Apple", ...product }, priceCents: price }, snippet);
    const { report } = run(
      [
        mk("neuf1.example", "Apple iPhone 15 128 Go noir", { condition: "new" }, 79900),
        mk("neuf2.example", "iPhone 15 128Go Noir - Apple - neuf", { condition: "new" }, 77900),
        mk("reco.example", "Apple iPhone 15 128 Go noir", { condition: "refurbished" }, 59900, "Reconditionné garanti 12 mois"),
        mk("occaz.example", "Apple iPhone 15 128 Go noir d'occasion", { condition: "used" }, 52900),
        mk("lot.example", "Apple iPhone 15 128 Go noir lot de 2", {}, 159000),
        mk("bleu.example", "Apple iPhone 15 128 Go bleu", { condition: "new" }, 76900),
        mk("pro.example", "Apple iPhone 15 Pro 128 Go noir", { condition: "new" }, 109900),
        mk("coque.example", "Coque silicone pour Apple iPhone 15 noir", {}, 1990),
      ],
      {},
      t,
    );
    const r = await report;
    expect(r.matches.map((m) => m.offer.seller.key).sort()).toEqual(["neuf1.example", "neuf2.example"]);
    expect(r.matches.every((m) => m.offer.product.condition === "new")).toBe(true);
    expect(r.bestItemPrice.EUR?.offer.seller.key).toBe("neuf2.example");
    const rejectedHosts = r.rejected.map((x) => new URL(x.url).hostname);
    expect(rejectedHosts).toEqual(expect.arrayContaining(["pro.example", "coque.example", "reco.example", "occaz.example", "lot.example", "bleu.example"]));
    // Le moins cher de tous (occasion à 529 €) n'a jamais pu devenir « meilleur prix ».
    expect(r.matches.some((m) => m.offer.priceCents < 70000)).toBe(false);
  });

  it("une fiche qui ne précise pas l'état n'est pas présentée comme neuve : « probable » avec confiance plafonnée", async () => {
    const t: ProductTarget = { identity: { brand: "Apple", name: "Apple iPhone 15 128 Go noir" }, condition: "new", currency: "EUR", country: "FR" };
    const { report } = run([page("flou.example", "Apple iPhone 15 128 Go noir", { product: { brand: "Apple" }, priceCents: 74900 })], {}, t);
    const r = await report;
    expect(r.matches).toHaveLength(1);
    expect(r.matches[0]!.match.verdict).toBe("probable");
    expect(r.matches[0]!.match.confidence).toBeLessThanOrEqual(0.8);
  });

  it("devise étrangère ou livraison impossible en France : conservées à part, jamais converties ni comparées", async () => {
    const { report } = run([
      page("fr.example", "NumWorks N0120 calculatrice", { product: { gtin: GTIN, condition: "new" }, priceCents: 9900 }),
      page("uk.example", "NumWorks N0120 calculator", { product: { gtin: GTIN, condition: "new" }, priceCents: 8000, currency: "GBP" }),
      page("us.example", "NumWorks N0120 calculatrice", { product: { gtin: GTIN, condition: "new" }, priceCents: 7000, shipsToFrance: false }),
    ]);
    const r = await report;
    expect(r.matches.map((m) => m.offer.seller.key)).toEqual(["fr.example"]);
    const reasons = Object.fromEntries(r.ineligible.map((i) => [i.offer.seller.key, i.reasons]));
    expect(reasons["uk.example"]).toEqual(["currency"]);
    expect(reasons["us.example"]).toEqual(["not_deliverable"]);
    expect(Object.keys(r.bestItemPrice)).toEqual(["EUR"]);
  });

  it("une fiche bloquée ou expirée est rapportée comme non vérifiable, sans prix ni stock inventé", async () => {
    const { report } = run([
      page("ok.example", "NumWorks N0120 calculatrice", { product: { gtin: GTIN, condition: "new" } }),
      { url: "https://bloque.example/p", title: "NumWorks N0120 calculatrice", failure: { reason: "blocked", transient: true } },
      { url: "https://lent.example/p", title: "Calculatrice NumWorks N0120", failure: { reason: "timeout", transient: true } },
      { url: "https://disparu.example/p", title: "NumWorks N0120", failure: { reason: "not_found", transient: false } },
    ]);
    const r = await report;
    expect(r.matches.map((m) => m.offer.seller.key)).toEqual(["ok.example"]);
    expect(r.unverifiable.map((u) => [new URL(u.url).hostname, u.reason, u.transient]).sort()).toEqual([
      ["bloque.example", "blocked", true],
      ["disparu.example", "not_found", false],
      ["lent.example", "timeout", true],
    ]);
    // Aucune de ces fiches n'apparaît ailleurs : ni offre, ni rupture de stock, ni variante.
    expect(r.matches.length + r.variants.length + r.rejected.length + r.ineligible.length).toBe(1);
  });

  it("dédoublonne les URL (paramètres de suivi) et garde une seule offre par vendeur (la moins chère)", async () => {
    const dup = page("doublon.example", "NumWorks N0120 calculatrice", { product: { gtin: GTIN, condition: "new" }, priceCents: 9900 });
    const dup2: SimulatedPage = { ...dup, url: dup.url.replace("https://doublon.example", "https://www.doublon.example") + "&gclid=abc#avis" };
    const sameSellerOtherUrl = page("doublon.example", "NumWorks N0120 calculatrice lycée", { product: { gtin: GTIN, condition: "new" }, priceCents: 9400 });
    const { web, report } = run([dup, dup2, sameSellerOtherUrl]);
    const r = await report;
    expect(r.matches).toHaveLength(1);
    expect(r.matches[0]!.offer.priceCents).toBe(9400);
    expect(web.calls.verify).toBeLessThanOrEqual(2);
    expect(dedupeCandidates([{ url: "https://a.example/x?utm_medium=z", title: "t", discoveredBy: "s", discoveredAt: NOW }, { url: "https://www.a.example/x/", title: "t", discoveredBy: "s", discoveredAt: NOW }])).toHaveLength(1);
  });

  it("limite les vérifications : les plus prometteuses d'abord, le reste signalé « budget »", async () => {
    const pages = Array.from({ length: 6 }, (_, i) => page(`shop${i}.example`, "NumWorks N0120 calculatrice", { product: { gtin: GTIN, condition: "new" }, priceCents: 9000 + i * 100 }));
    const { web, report } = run(pages, { maxVerifications: 2 });
    const r = await report;
    expect(web.calls.verify).toBe(2);
    expect(r.matches).toHaveLength(2);
    expect(r.uncertain.filter((u) => u.reason === "budget")).toHaveLength(4);
    expect(r.stats.budgetExhausted).toBe(true);
    const capped = run(pages, { maxCandidates: 3 });
    expect((await capped.report).stats.unique).toBe(3);
  });

  it("signale les offres périmées sans les écarter, et l'échec d'une source n'arrête pas la comparaison", async () => {
    const old = new Date(NOW.getTime() - 3 * 24 * 3600_000);
    const { report } = run([page("vieux.example", "NumWorks N0120 calculatrice", { product: { gtin: GTIN, condition: "new" }, checkedAt: old })], { maxOfferAgeMs: 24 * 3600_000 });
    expect((await report).matches[0]!.stale).toBe(true);
    const broken = createSimulatedWeb([], { failDiscovery: true, name: "moteur-en-panne" });
    const good = createSimulatedWeb([page("ok.example", "NumWorks N0120 calculatrice", { product: { gtin: GTIN, condition: "new" } })], { now: () => NOW });
    const r = await compareProduct(target, { sources: [broken.source, good.source], verifier: good.verifier, now: () => NOW });
    expect(r.sourceErrors).toEqual([{ source: "moteur-en-panne", message: "source simulée indisponible" }]);
    expect(r.matches).toHaveLength(1);
  });

  it("titres vagues : classés « non déterminés », jamais dans les offres retenues ni parmi les produits différents", async () => {
    const t: ProductTarget = { identity: { brand: "Samsung", name: "Samsung Galaxy S23 128 Go" }, condition: "new", currency: "EUR", country: "FR" };
    const { report } = run(
      [
        page("vague.example", "Smartphone Samsung Galaxy neuf", { product: { brand: "Samsung", name: "Samsung Galaxy", condition: "new" }, priceCents: 49900 }),
        page("precis.example", "Samsung Galaxy S23 128 Go neuf", { product: { brand: "Samsung", condition: "new" }, priceCents: 62900 }),
      ],
      {},
      t,
    );
    const r = await report;
    expect(r.matches.map((m) => m.offer.seller.key)).toEqual(["precis.example"]);
    expect(r.uncertain.map((u) => [new URL(u.url).hostname, u.reason])).toEqual([["vague.example", "inconclusive"]]);
  });

  it("outils : texte de recherche et prix livré", () => {
    expect(buildSearchText(target)).toBe("NumWorks Calculatrice graphique NumWorks N0120 N0120 neuf");
    expect(landedPrice({ priceCents: 1000, shipping: { kind: "known", cents: 250 } })).toBe(1250);
    expect(landedPrice({ priceCents: 1000, shipping: { kind: "free" } })).toBe(1000);
    expect(landedPrice({ priceCents: 1000, shipping: { kind: "unknown" } })).toBeNull();
    expect(landedPrice({ priceCents: 1000, shipping: { kind: "unavailable" } })).toBeNull();
  });
});
