import { describe, expect, it } from "vitest";
import { extractOfferFromHtml, mapAvailability, normalizeCurrency, parseDecimalToCents } from "../src/products";
import { GTIN, GTIN_OTHER, goodPage, html, ldProduct, offer, schema, shippingFR } from "./products-fixtures";

const URL_ = "https://boutique.example/produit/n0120";
const run = (h: string, url = URL_) => extractOfferFromHtml(h, url);
const ok = (h: string, url = URL_) => {
  const r = run(h, url);
  if (!r.ok) throw new Error(`échec inattendu : ${r.reason} (${r.detail})`);
  return r.data;
};
const fail = (h: string, url = URL_) => {
  const r = run(h, url);
  if (r.ok) throw new Error("succès inattendu");
  return r;
};

describe("montants et devises : l'ambigu reste inconnu", () => {
  it.each([
    ["99", 9900],
    ["99.90", 9990],
    ["1299,50", 129950],
    ["1 299,00", 129900],
    ["1.299,00", 129900],
    ["1,299.00", 129900],
    ["1.299.000", 129900000],
    ["12,5", 1250],
    [19.99, 1999],
    ["89,-", 8900],
    ["99 €", 9900],
  ])("%s → %s centimes", (raw, cents) => expect(parseDecimalToCents(raw)).toBe(cents));
  it.each(["1.299", "1,299", "19.999", "dès 10", "10-20", "", "abc", "1,2,3", null, undefined, -5, 19.999, Number.NaN])("%s → inconnu", (raw) => expect(parseDecimalToCents(raw as never)).toBeNull());
  it("devise : ISO en trois lettres, « € » et « £ » ; « $ » est ambigu donc refusé", () => {
    expect(normalizeCurrency("eur")).toBe("EUR");
    expect(normalizeCurrency("€")).toBe("EUR");
    expect(normalizeCurrency("$")).toBeNull();
    expect(normalizeCurrency("euros")).toBeNull();
    expect(normalizeCurrency(undefined)).toBeNull();
  });
  it("disponibilité : valeurs reconnues, le reste est « unknown »", () => {
    expect(mapAvailability("https://schema.org/InStock")?.value).toBe("in_stock");
    expect(mapAvailability("OutOfStock")?.value).toBe("out_of_stock");
    expect(mapAvailability("PreOrder")?.value).toBe("preorder");
    expect(mapAvailability("LimitedAvailability")?.value).toBe("limited");
    expect(mapAvailability("InStoreOnly")).toMatchObject({ value: "unknown", warning: "availability_in_store_only" });
    expect(mapAvailability("quelque chose")?.value).toBe("unknown");
    expect(mapAvailability(null)).toBeNull();
  });
});

describe("fiche bien renseignée (JSON-LD)", () => {
  it("lit nom, marque, référence, GTIN, état, prix, devise et disponibilité, avec leur source", () => {
    const d = ok(goodPage());
    expect(d).toMatchObject({ name: "Calculatrice graphique NumWorks N0120 noire", brand: "NumWorks", mpn: "N0120", gtin: "04006381333931", condition: "new", priceCents: 9900, currency: "EUR", availability: "in_stock", priceSource: "jsonld" });
    expect(d.fields).toMatchObject({ name: "jsonld", brand: "jsonld", gtin: "jsonld", mpn: "jsonld", price: "jsonld", currency: "jsonld", availability: "jsonld", condition: "jsonld" });
  });
  it("accepte @graph, les types en tableau et les URL de type complètes", () => {
    const h = html({ ld: [{ "@context": "https://schema.org", "@graph": [{ "@type": "WebSite", name: "Boutique" }, { ...ldProduct({ name: "NumWorks N0120", offers: offer({ price: 99, priceCurrency: "EUR" }) }), "@type": ["Product", "http://schema.org/Thing"] }] }] });
    expect(ok(h).priceCents).toBe(9900);
  });
  it("frais de livraison : lus seulement s'ils sont explicites pour la France", () => {
    expect(ok(goodPage({ shipping: shippingFR(4.9) })).shipping).toEqual({ kind: "known", cents: 490 });
    expect(ok(goodPage({ shipping: shippingFR(0) })).shipping).toEqual({ kind: "free" });
    const d = ok(goodPage({ shipping: shippingFR(4.9) }));
    expect(d.shipsToFrance).toBe(true);
    expect(d.fields.shipping).toBe("jsonld");
  });
  it("frais inconnus : absents, d'un autre pays, d'une autre devise ou contradictoires ne donnent jamais « 0 »", () => {
    expect(ok(goodPage()).shipping).toEqual({ kind: "unknown" });
    expect(ok(goodPage()).shipsToFrance).toBeNull();
    const de = { ...shippingFR(3), shippingDestination: { "@type": "DefinedRegion", addressCountry: "DE" } };
    expect(ok(goodPage({ shipping: de }))).toMatchObject({ shipping: { kind: "unknown" }, shipsToFrance: null });
    const gbp = ok(goodPage({ shipping: shippingFR(4, "GBP") }));
    expect(gbp.shipping).toEqual({ kind: "unknown" });
    expect(gbp.warnings).toContain("shipping_currency_mismatch_or_missing");
    const conflict = ok(goodPage({ shipping: [shippingFR(4), shippingFR(6)] }));
    expect(conflict.shipping).toEqual({ kind: "unknown" });
    expect(conflict.warnings).toContain("shipping_conflict");
  });
  it("état : jamais supposé « neuf » sans indication", () => {
    const h = html({ ld: [ldProduct({ name: "Calculatrice NumWorks N0120", offers: offer({ price: "99.00", priceCurrency: "EUR" }) })] });
    expect(ok(h).condition).toBe("unknown");
    expect(ok(goodPage({ condition: "RefurbishedCondition" })).condition).toBe("refurbished");
    expect(ok(goodPage({ condition: "UsedCondition" })).condition).toBe("used");
    expect(ok(goodPage({ condition: "DamagedCondition" })).condition).toBe("used");
  });
  it("disponibilité absente : « unknown », pas « en stock »", () => {
    const h = html({ ld: [ldProduct({ name: "NumWorks N0120", offers: offer({ price: "99.00", priceCurrency: "EUR" }) })] });
    const d = ok(h);
    expect(d.availability).toBe("unknown");
    expect(d.fields.availability).toBeUndefined();
  });
  it("produit indisponible : le prix et la rupture sont rapportés tels quels", () => {
    const d = ok(goodPage({ availability: "OutOfStock" }));
    expect(d).toMatchObject({ availability: "out_of_stock", priceCents: 9900 });
  });
  it("capacité, couleur, taille et modèle déclarés par la fiche enrichissent le titre sans être inventés", () => {
    const h = html({
      ld: [
        {
          ...ldProduct({ name: "Apple iPhone 15", brand: "Apple", model: "A3090", color: "Bleu", size: "6.1", offers: offer({ price: "799", priceCurrency: "EUR" }) }),
          additionalProperty: [
            { "@type": "PropertyValue", name: "Capacité", value: "256 Go" },
            { "@type": "PropertyValue", name: "Garantie", value: "2 ans" },
          ],
        },
      ],
    });
    const d = ok(h);
    expect(d.title).toContain("A3090");
    expect(d.title).toContain("Bleu");
    expect(d.title).toContain("256 Go");
    expect(d.title).not.toContain("2 ans");
    expect(d.fields.variant).toBe("jsonld");
  });
});

describe("données structurées malformées ou incomplètes", () => {
  const MALFORMED = '{"@context":"https://schema.org","@type":"Product","name":"NumWorks N0120","offers":{"@type":"Offer","price":"99.00","priceCurrency":"EUR",}}';
  it("un bloc JSON-LD malformé est ignoré (jamais réparé) et signalé ; sans autre source, aucune offre", () => {
    const r = fail(html({ rawLd: [MALFORMED] }));
    expect(r.reason).toBe("not_a_product_page");
    expect(r.warnings).toContain("jsonld_malformed");
  });
  it("avec des microdonnées valides, elles prennent le relais (source « microdata »)", () => {
    const body = `<div itemscope itemtype="https://schema.org/Product"><h1 itemprop="name">NumWorks N0120</h1><span itemprop="brand">NumWorks</span><span itemprop="mpn">N0120</span>
      <div itemprop="offers" itemscope itemtype="https://schema.org/Offer"><meta itemprop="priceCurrency" content="EUR"><span itemprop="price" content="99.00">99,00 €</span><link itemprop="availability" href="https://schema.org/InStock"></div></div>`;
    const d = ok(html({ rawLd: [MALFORMED], body }));
    expect(d).toMatchObject({ priceCents: 9900, currency: "EUR", availability: "in_stock", priceSource: "microdata", mpn: "N0120" });
    expect(d.warnings).toContain("jsonld_malformed");
  });
  it("balises meta (Open Graph / product:*) quand il n'y a rien d'autre", () => {
    const head = `<meta property="og:title" content="NumWorks N0120"><meta property="product:price:amount" content="99.00"><meta property="product:price:currency" content="EUR"><meta property="product:availability" content="out of stock">`;
    const d = ok(html({ head }));
    expect(d).toMatchObject({ priceCents: 9900, currency: "EUR", availability: "out_of_stock", priceSource: "meta", name: "NumWorks N0120" });
  });
  it("texte visible : accepté seulement si un prix unique, non barré, avec devise explicite ; source « html_text »", () => {
    const body = `<h1>NumWorks N0120</h1><div class="product-price"><del class="old-price">129,00 €</del> <span class="price-current">99,00 €</span></div>`;
    const d = ok(html({ body }));
    expect(d).toMatchObject({ priceCents: 9900, currency: "EUR", priceSource: "html_text" });
    expect(d.warnings).toContain("price_from_visible_text");
  });
  it("texte visible ambigu (deux prix courants différents) : prix inconnu", () => {
    const body = `<h1>NumWorks N0120</h1><div class="price">99,00 €</div><div class="price">149,00 €</div>`;
    const r = fail(html({ body }));
    expect(r.reason).toBe("price_not_found");
    expect(r.warnings).toContain("visible_price_ambiguous");
  });
  it("prix sans devise explicite : jamais « EUR » par défaut", () => {
    const h = html({ ld: [ldProduct({ name: "NumWorks N0120", offers: offer({ price: "99.00" }) })] });
    expect(fail(h).reason).toBe("unsupported_currency");
    const dollar = html({ ld: [ldProduct({ name: "NumWorks N0120", offers: offer({ price: "99.00", priceCurrency: "$" }) })] });
    expect(fail(dollar).reason).toBe("unsupported_currency");
  });
  it("prix illisible ou ambigu (« 1.299 », trois décimales, texte) : inconnu, avec le motif", () => {
    for (const price of ["1.299", "19.999", "sur demande", ""]) {
      const r = fail(html({ ld: [ldProduct({ name: "NumWorks N0120", offers: offer({ price, priceCurrency: "EUR" }) })] }));
      expect(r.reason, price).toBe("price_not_found");
    }
  });
  it("fiche sans prix (produit en rupture sans tarif) : aucun prix inventé", () => {
    const h = html({ ld: [ldProduct({ name: "NumWorks N0120", offers: offer({ availability: schema("OutOfStock"), priceCurrency: "EUR" }) })] });
    const r = fail(h);
    expect(r.reason).toBe("price_not_found");
  });
  it("page hostile avec des milliers d'éléments « price » : abandon rapide, prix inconnu", () => {
    const body = "<h1>NumWorks N0120</h1>" + Array.from({ length: 5000 }, (_, i) => `<div class="price"><span class="price-x">${i + 1},00 €</span></div>`).join("");
    const t0 = Date.now();
    const r = fail(html({ body }));
    expect(r.reason).toBe("price_not_found");
    expect(Date.now() - t0).toBeLessThan(3000);
  });
  it("structures pathologiques (imbrication profonde, énormes tableaux) : pas de plantage", () => {
    let deep: unknown = { "@type": "Product", name: "x" };
    for (let i = 0; i < 200; i++) deep = { "@graph": [deep] };
    const huge = Array.from({ length: 20000 }, (_, i) => ({ "@type": "Thing", name: String(i) }));
    const h = html({ ld: [deep, huge, ldProduct({ name: "NumWorks N0120", offers: offer({ price: "99", priceCurrency: "EUR" }) })] });
    expect(() => run(h)).not.toThrow();
  });
});

describe("données contradictoires : aucune valeur n'est retenue", () => {
  it("prix JSON-LD ≠ prix meta → conflicting_data", () => {
    const head = `<meta property="product:price:amount" content="79.00"><meta property="product:price:currency" content="EUR">`;
    const r = fail(html({ head, ld: [ldProduct({ name: "NumWorks N0120", offers: offer({ price: "99.00", priceCurrency: "EUR" }) })] }));
    expect(r.reason).toBe("conflicting_data");
  });
  it("devise JSON-LD ≠ devise meta → conflicting_data", () => {
    const head = `<meta property="product:price:amount" content="99.00"><meta property="product:price:currency" content="GBP">`;
    expect(fail(html({ head, ld: [ldProduct({ name: "NumWorks N0120", offers: offer({ price: "99.00", priceCurrency: "EUR" }) })] })).reason).toBe("conflicting_data");
  });
  it("prix JSON-LD ≠ prix visible unique → conflicting_data ; identique → accepté", () => {
    const ld = ldProduct({ name: "NumWorks N0120", offers: offer({ price: "99.00", priceCurrency: "EUR" }) });
    expect(fail(html({ ld: [ld], body: `<div class="price">89,00 €</div>` })).reason).toBe("conflicting_data");
    expect(ok(html({ ld: [ld], body: `<div class="price">99,00 €</div>` })).priceCents).toBe(9900);
  });
  it("disponibilité contradictoire : le prix reste, le stock devient inconnu", () => {
    const head = `<meta property="product:availability" content="out of stock">`;
    const d = ok(html({ head, ld: [ldProduct({ name: "NumWorks N0120", offers: offer({ price: "99.00", priceCurrency: "EUR", availability: schema("InStock") }) })] }));
    expect(d.availability).toBe("unknown");
    expect(d.warnings).toContain("availability_conflict");
  });
  it("plusieurs produits distincts dans la page (produits liés) → conflicting_data ; le même produit répété → accepté", () => {
    const a = ldProduct({ name: "NumWorks N0120", offers: offer({ price: "99", priceCurrency: "EUR" }) });
    const b = ldProduct({ name: "Coque NumWorks", offers: offer({ price: "9", priceCurrency: "EUR" }) });
    expect(fail(html({ ld: [a, b] })).reason).toBe("conflicting_data");
    expect(ok(html({ ld: [a, a] })).priceCents).toBe(9900);
    // Le produit dont l'adresse correspond est retenu.
    const a2 = ldProduct({ name: "NumWorks N0120", url: URL_, offers: offer({ price: "99", priceCurrency: "EUR" }) });
    expect(ok(html({ ld: [a2, b] })).priceCents).toBe(9900);
  });
  it("GTIN invalide ignoré ; deux GTIN valides différents → aucun GTIN retenu ; UPC-A normalisé", () => {
    const bad = ok(html({ ld: [ldProduct({ name: "NumWorks N0120", gtin13: "4006381333932", offers: offer({ price: "99", priceCurrency: "EUR" }) })] }));
    expect(bad.gtin).toBeUndefined();
    expect(bad.warnings).toContain("gtin_invalid");
    const both = ok(html({ ld: [{ ...ldProduct({ name: "NumWorks N0120", gtin13: GTIN, offers: offer({ price: "99", priceCurrency: "EUR" }) }), gtin: GTIN_OTHER }] }));
    expect(both.gtin).toBeUndefined();
    expect(both.warnings).toContain("gtin_conflict");
    const upc = ok(html({ ld: [{ ...ldProduct({ name: "Produit", offers: offer({ price: "9", priceCurrency: "USD" }) }), gtin12: "036000291452" }] }));
    expect(upc.gtin).toBe("00036000291452");
  });
  it("MPN en conflit entre JSON-LD et microdonnées → aucune référence retenue", () => {
    const body = `<div itemscope itemtype="https://schema.org/Product"><span itemprop="mpn">N0999</span></div>`;
    const d = ok(html({ body, ld: [ldProduct({ name: "NumWorks N0120", mpn: "N0120", offers: offer({ price: "99", priceCurrency: "EUR" }) })] }));
    expect(d.mpn).toBeUndefined();
    expect(d.warnings).toContain("mpn_conflict");
  });
});

describe("variantes et devises multiples", () => {
  const group = (variants: Array<{ sku: string; price: string; url?: string; color?: string }>) => ({
    "@context": "https://schema.org",
    "@type": "ProductGroup",
    name: "Apple iPhone 15",
    productGroupID: "iphone15",
    hasVariant: variants.map((v) => ({ "@type": "Product", sku: v.sku, color: v.color, ...(v.url ? { url: v.url } : {}), offers: offer({ price: v.price, priceCurrency: "EUR", availability: schema("InStock"), url: v.url }) })),
  });
  it("ProductGroup : la variante désignée par l'adresse (paramètre ou URL) est retenue", () => {
    const g = group([
      { sku: "IP15-128", price: "799", color: "Noir" },
      { sku: "IP15-256", price: "899", color: "Bleu" },
    ]);
    expect(ok(html({ ld: [g] }), "https://boutique.example/iphone-15?variant=ip15-256")).toMatchObject({ priceCents: 89900 });
    const byUrl = group([
      { sku: "A", price: "799", url: "https://boutique.example/iphone-15?c=noir" },
      { sku: "B", price: "899", url: "https://boutique.example/iphone-15?c=bleu" },
    ]);
    expect(ok(html({ ld: [byUrl] }), "https://boutique.example/iphone-15?c=bleu").priceCents).toBe(89900);
  });
  it("prix différents et aucune variante désignée → ambiguous_variant (aucun prix choisi)", () => {
    const g = group([
      { sku: "IP15-128", price: "799" },
      { sku: "IP15-256", price: "899" },
    ]);
    expect(fail(html({ ld: [g] })).reason).toBe("ambiguous_variant");
  });
  it("variantes au même prix : acceptées, avec une alerte « variante non identifiée »", () => {
    const g = group([
      { sku: "IP15-NOIR", price: "799" },
      { sku: "IP15-BLEU", price: "799" },
    ]);
    const d = ok(html({ ld: [g] }));
    expect(d.priceCents).toBe(79900);
    expect(d.warnings).toContain("variant_not_identified_same_price");
  });
  it("offres multiples d'un même produit : même prix accepté, prix différents ambigus, URL de l'offre désignée retenue", () => {
    const same = html({ ld: [ldProduct({ name: "Casque X", offers: [offer({ price: "50", priceCurrency: "EUR", sku: "a" }), offer({ price: "50", priceCurrency: "EUR", sku: "b" })] })] });
    expect(ok(same).priceCents).toBe(5000);
    const diff = html({ ld: [ldProduct({ name: "Casque X", offers: [offer({ price: "50", priceCurrency: "EUR", url: "https://boutique.example/x?v=1" }), offer({ price: "60", priceCurrency: "EUR", url: "https://boutique.example/x?v=2" })] })] });
    expect(fail(diff, "https://boutique.example/x").reason).toBe("ambiguous_variant");
    expect(ok(diff, "https://boutique.example/x?v=2").priceCents).toBe(6000);
  });
  it("AggregateOffer : une fourchette de prix n'est jamais un prix ; lowPrice = highPrice l'est", () => {
    const range = html({ ld: [ldProduct({ name: "Casque X", offers: { "@type": "AggregateOffer", lowPrice: "40", highPrice: "80", priceCurrency: "EUR", offerCount: 3 } })] });
    expect(fail(range).reason).toBe("ambiguous_variant");
    const single = html({ ld: [ldProduct({ name: "Casque X", offers: { "@type": "AggregateOffer", lowPrice: "40", highPrice: "40", priceCurrency: "EUR" } })] });
    expect(ok(single).priceCents).toBe(4000);
  });
  it("devises : chaque prix garde sa devise, sans conversion", () => {
    for (const c of ["EUR", "GBP", "CHF", "USD"]) expect(ok(goodPage({ currency: c })).currency).toBe(c);
  });
});

describe("pages sans produit", () => {
  it("page anti-robot : « blocked » (aucun contournement)", () => {
    const r = fail(html({ title: "Just a moment...", body: "<h1>Checking your browser before accessing</h1>" }));
    expect(r.reason).toBe("blocked");
    expect(fail(html({ title: "Vérification", body: "<p>Veuillez résoudre ce captcha pour continuer</p>" })).reason).toBe("blocked");
  });
  it("page introuvable servie avec un code 200 : « not_found »", () => {
    expect(fail(html({ title: "Page introuvable - Boutique", body: "<h1>Erreur 404</h1>" })).reason).toBe("not_found");
  });
  it("autre page (accueil, article…) : « not_a_product_page »", () => {
    expect(fail(html({ title: "Accueil", body: "<h1>Bienvenue</h1><p>Nos offres</p>" })).reason).toBe("not_a_product_page");
  });
  it("produit nommé mais sans nom lisible : « parse_failed »", () => {
    const r = fail(html({ ld: [ldProduct({ offers: offer({ price: "99", priceCurrency: "EUR" }) })], body: "<p>Détail</p>" }));
    expect(r.reason).toBe("parse_failed");
  });
});
