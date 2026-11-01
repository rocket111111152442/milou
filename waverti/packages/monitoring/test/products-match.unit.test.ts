import { describe, expect, it } from "vitest";
import type { VerifiedOffer } from "../src/products";
import { analyze, assessOffer, canonicalizeUrl, compareListings, gtinChecksumOk, normalizeGtin, normalizeMpn, registrableDomain, type ListingInput, type ProductIdentity } from "../src/products";

const L = (title: string, identity: Partial<ProductIdentity> = {}, hintText?: string): ListingInput => ({ identity: { name: title, ...identity }, title, hintText });
const offerFixture = (): VerifiedOffer => ({
  url: "https://boutique-a.example/p/1",
  canonicalUrl: "https://boutique-a.example/p/1",
  seller: { key: "boutique-a.example", name: "Boutique A" },
  product: { name: "x" },
  title: "x",
  priceCents: 79900,
  currency: "EUR",
  availability: "in_stock",
  shipping: { kind: "unknown" },
  checkedAt: new Date("2026-11-01T10:00:00Z"),
  shipsToFrance: true,
});
const verdict = (a: ListingInput, b: ListingInput) => compareListings(a, b);

describe("identifiants", () => {
  it("valide la clé de contrôle des GTIN (EAN-13, UPC-A, EAN-8) et normalise sur 14 chiffres", () => {
    expect(gtinChecksumOk("4006381333931")).toBe(true);
    expect(gtinChecksumOk("4006381333932")).toBe(false);
    expect(normalizeGtin("4006381333931")).toBe("04006381333931");
    // UPC-A (12 chiffres) et EAN-13 précédé d'un zéro désignent le même produit.
    expect(normalizeGtin("036000291452")).toBe(normalizeGtin("0036000291452"));
    expect(normalizeGtin("96385074")).toBe("00000096385074");
    expect(normalizeGtin("123")).toBeNull();
    expect(normalizeGtin("4006381333932")).toBeNull();
    expect(normalizeGtin("4006 3813 33931")).toBe("04006381333931");
  });
  it("ignore les références fabricant trop courtes ou purement numériques courtes", () => {
    expect(normalizeMpn("N0120")).toBe("N0120");
    expect(normalizeMpn("n-0120")).toBe("N0120");
    expect(normalizeMpn("A1")).toBeNull();
    expect(normalizeMpn("123")).toBeNull();
    expect(normalizeMpn(undefined)).toBeNull();
  });
  it("canonise les URL (suivi retiré, www, fragment, barre finale) et refuse les schémas non web", () => {
    expect(canonicalizeUrl("https://www.Boutique.fr/p/abc/?utm_source=x&b=2&a=1&gclid=zz#avis")).toBe("https://boutique.fr/p/abc?a=1&b=2");
    expect(canonicalizeUrl("javascript:alert(1)")).toBeNull();
    expect(canonicalizeUrl("pas une url")).toBeNull();
    expect(registrableDomain("shop.exemple.co.uk")).toBe("exemple.co.uk");
    expect(registrableDomain("www.exemple.fr")).toBe("exemple.fr");
  });
});

describe("extraction des caractéristiques", () => {
  it("lit capacité, mémoire vive, taille, couleur, version, état et quantité", () => {
    const a = analyze(L("Samsung Galaxy Tab S9 11 pouces 256 Go 12 Go de RAM Wi-Fi Graphite noir neuf"));
    expect(a.variant).toMatchObject({ storageGb: 256, ramGb: 12, size: "inch:11", color: "noir", edition: "wifi" });
    expect(a.condition).toBe("new");
    expect(analyze(L("SSD 1 To")).variant.storageGb).toBe(1000);
    expect(analyze(L("Câbles USB-C lot de 3")).variant.quantity).toBe(3);
    expect(analyze(L("iPad Pro 12,9 pouces 5G")).variant).toMatchObject({ size: "inch:12.9", edition: "5g" });
  });
  it("ne suppose jamais « neuf » : sans mention, l'état reste inconnu", () => {
    expect(analyze(L("Apple iPhone 15 128 Go noir")).condition).toBe("unknown");
    expect(analyze(L("iPhone 15 reconditionné - très bon état")).condition).toBe("refurbished");
    expect(analyze(L("iPhone 15 comme neuf")).condition).toBe("used");
    expect(analyze(L("iPhone 15", {}, "Smartphone reconditionné garanti 12 mois")).condition).toBe("refurbished");
  });
  it("repère accessoires et lots", () => {
    expect(analyze(L("Coque de protection pour iPhone 15")).accessory).toBe(true);
    expect(analyze(L("Chargeur compatible iPhone 15")).accessory).toBe(true);
    expect(analyze(L("Apple iPhone 15 128 Go")).accessory).toBe(false);
    expect(analyze(L("iPhone 15 avec coque et chargeur")).bundle).toBe(true);
    expect(analyze(L("Pack console + jeu")).bundle).toBe(true);
    expect(analyze(L("Apple iPhone 15 128 Go")).bundle).toBe(false);
  });
});

describe("même produit : exact, probable", () => {
  it("GTIN identique chez deux marchands malgré des titres très différents → exact", () => {
    const a = L("Calculatrice graphique NumWorks N0120 - Noire", { brand: "NumWorks", gtin: "4006381333931" });
    const b = L("NUMWORKS Calculatrice Python lycée neuf livraison gratuite", { brand: "NumWorks", gtin: "4006381333931" });
    const r = verdict(a, b);
    expect(r).toMatchObject({ verdict: "exact" });
    expect(r.confidence).toBeGreaterThanOrEqual(0.9);
    expect(r.reasons).toContain("gtin_equal");
  });
  it("même MPN et même marque → exact (confiance un peu moindre qu'avec GTIN)", () => {
    const r = verdict(L("NumWorks calculatrice", { brand: "NumWorks", mpn: "N0120" }), L("Calculatrice NumWorks N-0120", { brand: "numworks", mpn: "n 0120" }));
    expect(r.verdict).toBe("exact");
    expect(r.confidence).toBeLessThan(0.97);
  });
  it("sans identifiant, mêmes marque et modèle dans le titre → probable, jamais exact", () => {
    const r = verdict(L("Apple iPhone 15 128 Go noir", { brand: "Apple" }), L("iPhone 15 128Go Noir - Apple", { brand: "Apple" }));
    expect(r.verdict).toBe("probable");
    expect(r.reasons).toContain("no_identifier");
    expect(r.confidence).toBeLessThan(0.9);
  });
  it("un GTIN invalide est ignoré : il ne peut pas servir de preuve", () => {
    const r = verdict(L("Apple iPhone 15 128 Go", { brand: "Apple", gtin: "1234567890123" }), L("Apple iPhone 15 128 Go", { brand: "Apple", gtin: "1234567890123" }));
    expect(r.verdict).toBe("probable");
  });
});

describe("variantes : jamais mélangées avec le produit visé", () => {
  const base = L("Apple iPhone 15 128 Go noir neuf", { brand: "Apple", condition: "new" });
  it.each([
    ["autre capacité", "Apple iPhone 15 256 Go noir neuf", "storage"],
    ["autre couleur", "Apple iPhone 15 128 Go bleu neuf", "color"],
    ["lot de deux", "Apple iPhone 15 128 Go noir neuf lot de 2", "quantity"],
    ["avec accessoires (bundle)", "Apple iPhone 15 128 Go noir neuf avec coque et chargeur", "bundle"],
  ])("%s → variant", (_n, title, dim) => {
    const r = verdict(base, L(title, { brand: "Apple" }));
    expect(r.verdict).toBe("variant");
    expect(r.differingDimensions).toContain(dim);
  });
  it("deux tailles d'écran, deux tailles de boîtier → variant", () => {
    expect(verdict(L("Apple Watch Series 9 GPS 41 mm", { brand: "Apple" }), L("Apple Watch Series 9 GPS 45 mm", { brand: "Apple" })).differingDimensions).toContain("size");
    expect(verdict(L("MacBook Air 13 pouces M2 256 Go", { brand: "Apple" }), L("MacBook Air 15 pouces M2 256 Go", { brand: "Apple" })).verdict).toBe("variant");
  });
  it("version Wi-Fi contre Wi-Fi + Cellular → variant", () => {
    const r = verdict(L("Apple iPad 10e génération Wi-Fi 64 Go", { brand: "Apple" }), L("Apple iPad 10e génération Wi-Fi + Cellular 64 Go", { brand: "Apple" }));
    expect(r.verdict).toBe("variant");
    expect(r.differingDimensions).toContain("edition");
  });
  it("neuf contre reconditionné, neuf contre occasion → variant (état)", () => {
    const target = L("Apple iPhone 15 128 Go", { brand: "Apple", condition: "new" });
    expect(verdict(target, L("Apple iPhone 15 128 Go reconditionné", { brand: "Apple" })).differingDimensions).toContain("condition");
    expect(verdict(target, L("Apple iPhone 15 128 Go d'occasion", { brand: "Apple" })).verdict).toBe("variant");
    // L'extrait de recherche révèle l'état même si le titre est muet.
    expect(verdict(target, L("Apple iPhone 15 128 Go", { brand: "Apple" }, "Reconditionné par un professionnel, garantie 12 mois")).verdict).toBe("variant");
  });
  it("état non indiqué : l'identité du produit reste établie, mais jamais supposé neuf pour la cible", () => {
    const gtin = "4006381333931";
    const r = verdict(L("Apple iPhone 15 128 Go", { brand: "Apple", condition: "new", gtin }), L("Apple iPhone 15 128 Go", { brand: "Apple", gtin }));
    expect(r.reasons).toContain("condition_unknown");
    expect(r.verdict).toBe("exact");
    const target = { identity: { name: "Apple iPhone 15 128 Go", brand: "Apple", gtin }, condition: "new" as const, currency: "EUR", country: "FR" };
    const offer = { ...offerFixture(), title: "Apple iPhone 15 128 Go", product: { name: "Apple iPhone 15 128 Go", brand: "Apple", gtin } };
    const assessed = assessOffer(target, offer);
    expect(assessed.match.verdict).toBe("probable");
    expect(assessed.match.confidence).toBeLessThanOrEqual(0.8);
    expect(assessed.match.explanation).toMatch(/n'est pas indiqué/);
  });
  it("GTIN différent mais même titre : une autre déclinaison, pas « probablement identique »", () => {
    const r = verdict(L("Casque Sony WH-1000XM5", { brand: "Sony", gtin: "4548736134638" }), L("Casque Sony WH-1000XM5", { brand: "Sony", gtin: "4548736134997" }));
    expect(["variant", "different"]).toContain(r.verdict);
    expect(r.verdict).not.toBe("exact");
    expect(r.reasons).toContain("gtin_differs");
  });
});

describe("produits différents", () => {
  it.each([
    ["accessoire", "Apple iPhone 15 128 Go", "Coque transparente pour iPhone 15 128 Go", "accessory"],
    ["accessoire (chargeur compatible)", "Apple iPhone 15 128 Go", "Chargeur rapide compatible iPhone 15", "accessory"],
    ["génération voisine", "Apple iPhone 15 128 Go", "Apple iPhone 14 128 Go", "model_differs"],
    ["gamme Pro", "Apple iPhone 15 128 Go", "Apple iPhone 15 Pro 128 Go", "tier_differs"],
    ["gamme Ultra", "Samsung Galaxy S23", "Samsung Galaxy S23 Ultra", "tier_differs"],
    ["génération numérotée", "Kindle Paperwhite 11e génération 8 Go", "Kindle Paperwhite 12e génération 8 Go", "generation_differs"],
    ["millésime", "TV LG OLED C3 55 pouces 2023", "TV LG OLED C3 55 pouces 2024", "generation_differs"],
    ["chiffres romains", "Sony WH-1000X Mark II", "Sony WH-1000X Mark III", "model_differs"],
  ])("%s → different", (_n, a, b, reason) => {
    const r = verdict(L(a, { brand: a.split(" ")[0] }), L(b, { brand: a.split(" ")[0] }));
    expect(r.verdict).toBe("different");
    expect(r.reasons).toContain(reason);
    expect(r.inconclusive).toBe(false);
  });
  it("marques différentes → different", () => {
    expect(verdict(L("Casque Bluetooth XM5", { brand: "Sony" }), L("Casque Bluetooth XM5", { brand: "Bose" })).reasons).toContain("brand_differs");
  });
  it("un accessoire n'est pas confondu avec le produit même s'ils partagent un GTIN erroné", () => {
    const r = verdict(L("Apple iPhone 15 128 Go", { brand: "Apple", gtin: "0194253396000".slice(0, 12) + "0" }), L("Étui en cuir pour iPhone 15", { brand: "Apple", gtin: "0194253396000".slice(0, 12) + "0" }));
    expect(r.verdict).toBe("different");
    expect(r.reasons).toContain("accessory");
  });
});

describe("données volontairement ambiguës", () => {
  it("titre trop vague (« Samsung Galaxy ») contre un modèle précis → écarté comme NON DÉTERMINÉ, pas comme « autre produit »", () => {
    const r = verdict(L("Samsung Galaxy S23 128 Go", { brand: "Samsung" }), L("Smartphone Samsung Galaxy neuf", { brand: "Samsung" }));
    expect(r.verdict).toBe("different");
    expect(r.inconclusive).toBe(true);
    expect(r.reasons).toContain("attribute_missing");
  });
  it("génération présente d'un seul côté → non déterminé", () => {
    const r = verdict(L("Kindle Paperwhite 11e génération", { brand: "Amazon" }), L("Liseuse Kindle Paperwhite", { brand: "Amazon" }));
    expect(r.inconclusive || r.verdict === "probable").toBe(true);
    if (r.verdict === "probable") expect(r.confidence).toBeLessThan(0.7);
  });
  it("capacité absente d'un côté : probable, mais avec une confiance réduite et le manque signalé", () => {
    const full = verdict(L("Apple iPhone 15 128 Go noir", { brand: "Apple" }), L("Apple iPhone 15 128 Go noir", { brand: "Apple" }));
    const partial = verdict(L("Apple iPhone 15 128 Go noir", { brand: "Apple" }), L("Apple iPhone 15 noir", { brand: "Apple" }));
    expect(partial.verdict).toBe("probable");
    expect(partial.reasons).toContain("attribute_missing");
    expect(partial.confidence).toBeLessThan(full.confidence);
  });
  it("identifiants en conflit (même GTIN, MPN différents) : jamais « exact »", () => {
    const r = verdict(L("Casque Sony WH-1000XM5", { brand: "Sony", gtin: "4548736134638", mpn: "WH1000XM5B" }), L("Casque Sony WH-1000XM5", { brand: "Sony", gtin: "4548736134638", mpn: "WH1000XM5S" }));
    expect(r.verdict).toBe("probable");
    expect(r.reasons).toContain("identifier_contradiction");
    expect(r.confidence).toBeLessThanOrEqual(0.55);
  });
  it("la casse, les accents et la ponctuation ne créent aucune différence", () => {
    const r = verdict(L("CALCULATRICE NUMWORKS - N0120 !!!", { brand: "NUMWORKS" }), L("calculatrice numworks (n0120)", { brand: "NumWorks" }));
    expect(["exact", "probable"]).toContain(r.verdict);
  });
  it("le rapprochement est symétrique", () => {
    const pairs: Array<[ListingInput, ListingInput]> = [
      [L("Apple iPhone 15 128 Go", { brand: "Apple" }), L("Apple iPhone 15 256 Go", { brand: "Apple" })],
      [L("Apple iPhone 15 128 Go", { brand: "Apple" }), L("Coque iPhone 15", { brand: "Apple" })],
      [L("Galaxy S23", { brand: "Samsung" }), L("Galaxy S23 Ultra", { brand: "Samsung" })],
      [L("Apple iPhone 15 128 Go noir", { brand: "Apple" }), L("Apple iPhone 15 noir", { brand: "Apple" })],
    ];
    for (const [x, y] of pairs) {
      const r1 = verdict(x, y);
      const r2 = verdict(y, x);
      expect(r2.verdict).toBe(r1.verdict);
      expect(r2.confidence).toBeCloseTo(r1.confidence, 2);
    }
  });
});
