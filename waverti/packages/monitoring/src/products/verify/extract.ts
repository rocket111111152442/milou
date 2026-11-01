/**
 * Extraction d'une offre depuis le HTML d'une fiche produit.
 *
 * Règles de fiabilité :
 *  - une donnée absente reste inconnue (prix, devise, stock, frais, GTIN, état) ; rien n'est déduit ni complété ;
 *  - des sources qui se contredisent (prix, produits, GTIN) n'en font retenir aucune ;
 *  - plusieurs variantes de prix différents sans moyen de savoir laquelle est visée → échec « ambiguous_variant » ;
 *  - chaque champ garde sa source (JSON-LD, microdonnées, meta, texte visible).
 */
import * as cheerio from "cheerio/slim";
import { canonicalizeUrl, normalizeGtin, normalizeMpn, normalizeText } from "../text";
import type { Availability, DataSource, ItemCondition, ShippingCost, TracedField, VerificationFailureReason } from "../types";
import { extractFallback } from "./fallback";
import { extractJsonLd, type RawOffer, type RawProduct } from "./jsonld";

export interface ExtractedOffer {
  name: string;
  /** Titre enrichi (modèle, couleur, taille, capacité) lu sur la fiche : sert au rapprochement. */
  title: string;
  brand?: string;
  model?: string;
  mpn?: string;
  gtin?: string;
  condition: ItemCondition;
  priceCents: number;
  currency: string;
  availability: Availability;
  shipping: ShippingCost;
  shipsToFrance: boolean | null;
  sellerName?: string;
  priceSource: DataSource;
  fields: Partial<Record<TracedField, DataSource>>;
  warnings: string[];
}

export type ExtractionResult =
  | { ok: true; data: ExtractedOffer }
  | { ok: false; reason: VerificationFailureReason; detail: string; warnings: string[] };

const MAX_HTML_CHARS = 3_000_000;
const CHALLENGE = /(just a moment|attention required|checking your browser|verify you are (a )?human|captcha|access denied|are you a robot|robot check|request blocked|cf-chl|incapsula|perimeterx|verification de securite|etes-vous un robot|acces refuse)/;
const GONE = /(\b404\b|page (introuvable|non trouvee|inexistante)|not found|n'existe (plus|pas)|produit (introuvable|n'existe)|cette page n'existe)/;

export function mapAvailability(raw: string | null | undefined): { value: Availability; warning?: string } | null {
  if (!raw) return null;
  const k = raw.replace(/^.*[/#]/, "").toLowerCase().replace(/[^a-z]/g, "");
  if (["instock", "onlineonly", "available"].includes(k)) return { value: "in_stock" };
  if (["outofstock", "soldout", "discontinued", "oos", "outofstockonline"].includes(k)) return { value: "out_of_stock" };
  if (["preorder", "presale", "backorder", "pending"].includes(k)) return { value: "preorder" };
  if (k === "limitedavailability") return { value: "limited" };
  if (k === "instoreonly") return { value: "unknown", warning: "availability_in_store_only" };
  return { value: "unknown", warning: "availability_unrecognized" };
}

function mapCondition(raw: string | null | undefined): ItemCondition | null {
  if (!raw) return null;
  const k = raw.toLowerCase().replace(/[^a-z]/g, "").replace(/condition$/, "");
  if (k === "new") return "new";
  if (k === "refurbished") return "refurbished";
  if (k === "used" || k === "damaged") return "used";
  return null;
}

const canonicalPathQuery = (u: string | null): string | null => {
  if (!u) return null;
  try {
    return canonicalizeUrl(u);
  } catch {
    return null;
  }
};

function urlHints(finalUrl: string): Set<string> {
  const hints = new Set<string>();
  try {
    const u = new URL(finalUrl);
    for (const [k, v] of u.searchParams) if (/^(variant|variation_id|sku|id|offer|pid|product_id)$/i.test(k) && v) hints.add(v.toLowerCase());
  } catch {
    /* URL déjà validée par le vérificateur */
  }
  return hints;
}

interface Resolved {
  product: RawProduct;
  offers: RawOffer[];
  warnings: string[];
}

/** Choisit le produit (et la variante) visé par l'adresse ; null si impossible sans deviner. */
function resolve(products: RawProduct[], finalUrl: string): Resolved | { fail: VerificationFailureReason; detail: string } {
  const warnings: string[] = [];
  const hints = urlHints(finalUrl);
  const here = canonicalPathQuery(finalUrl);

  // 1. Un seul produit logique : doublons éventuels (même nom + mêmes références) fusionnés.
  const key = (p: RawProduct) => `${normalizeText(p.name ?? "")}|${normalizeMpn(p.mpn) ?? ""}|${p.sku ?? ""}`;
  const unique = new Map<string, RawProduct>();
  for (const p of products) if (!unique.has(key(p))) unique.set(key(p), p);
  let list = [...unique.values()];
  if (list.length > 1) {
    const byUrl = list.filter((p) => canonicalPathQuery(p.url) === here);
    if (byUrl.length === 1) list = byUrl;
    else return { fail: "conflicting_data", detail: `${list.length} produits distincts dans les données structurées` };
  }
  const product = list[0]!;

  // 2. Variantes d'un groupe ou offres multiples : on ne retient que ce que l'adresse désigne.
  const candidates: Array<{ offer: RawOffer; variant: RawProduct | null }> = [];
  if (product.kind === "ProductGroup" && product.variants.length) {
    for (const v of product.variants) for (const o of v.offers) candidates.push({ offer: o, variant: v });
    if (!candidates.length) for (const o of product.offers) candidates.push({ offer: o, variant: null });
  } else {
    for (const o of product.offers) candidates.push({ offer: o, variant: null });
  }
  if (!candidates.length) return { product, offers: [], warnings };
  if (candidates.length === 1) return { product: candidates[0]!.variant ?? product, offers: [candidates[0]!.offer], warnings };

  const matches = candidates.filter(({ offer, variant }) => {
    if (canonicalPathQuery(offer.url) === here && offer.url) return true;
    if (variant && canonicalPathQuery(variant.url) === here && variant.url) return true;
    const skus = [offer.sku, variant?.sku].filter((x): x is string => Boolean(x)).map((x) => x.toLowerCase());
    return skus.some((s) => hints.has(s));
  });
  if (matches.length === 1) return { product: matches[0]!.variant ?? product, offers: [matches[0]!.offer], warnings };

  // Aucune variante désignée : acceptable seulement si TOUTES annoncent le même prix et la même devise.
  const prices = new Set(candidates.map((c) => `${c.offer.priceCents ?? "?"}|${c.offer.currency ?? "?"}`));
  if (prices.size === 1) {
    warnings.push("variant_not_identified_same_price");
    return { product, offers: candidates.map((c) => c.offer), warnings };
  }
  return { fail: "ambiguous_variant", detail: `${candidates.length} variantes à des prix différents, aucune désignée par l'adresse` };
}

function pickShipping(offers: RawOffer[], currency: string | null, country: string, warnings: string[]): { shipping: ShippingCost; ships: boolean | null; listed: boolean } {
  const entries = offers.flatMap((o) => o.shipping).filter((s) => s.countries.includes(country));
  if (!entries.length) return { shipping: { kind: "unknown" }, ships: null, listed: false };
  const costs = new Set(entries.map((e) => (e.cents === 0 ? "free" : e.cents !== null && e.currency === currency ? `c${e.cents}` : "?")));
  if (costs.size !== 1) {
    warnings.push("shipping_conflict");
    return { shipping: { kind: "unknown" }, ships: true, listed: true };
  }
  const c = [...costs][0]!;
  if (c === "free") return { shipping: { kind: "free" }, ships: true, listed: true };
  if (c.startsWith("c")) return { shipping: { kind: "known", cents: Number(c.slice(1)) }, ships: true, listed: true };
  warnings.push("shipping_currency_mismatch_or_missing");
  return { shipping: { kind: "unknown" }, ships: true, listed: true };
}

export function extractOfferFromHtml(htmlInput: string, finalUrl: string, opts: { country?: string } = {}): ExtractionResult {
  const country = (opts.country ?? "FR").toUpperCase();
  const html = htmlInput.length > MAX_HTML_CHARS ? htmlInput.slice(0, MAX_HTML_CHARS) : htmlInput;
  const $ = cheerio.load(html);
  const ld = extractJsonLd($);
  const fb = extractFallback($);
  const warnings = [...ld.warnings, ...fb.warnings];
  const fields: ExtractedOffer["fields"] = {};

  const hasMicrodata = $('[itemtype*="schema.org/Product" i]').length > 0;
  const hasProductEvidence = ld.products.length > 0 || hasMicrodata || fb.priceCents !== null || fb.priceUnreadable;
  if (!hasProductEvidence) {
    const head = normalizeText(`${$("title").first().text()} ${$("h1").first().text()}`);
    const body = normalizeText($("body").text().slice(0, 4000));
    if (CHALLENGE.test(head) || CHALLENGE.test(body)) return { ok: false, reason: "blocked", detail: "page de vérification anti-robot (non contournée)", warnings };
    if (GONE.test(head)) return { ok: false, reason: "not_found", detail: "page introuvable (code 200)", warnings };
    return { ok: false, reason: "not_a_product_page", detail: "aucune donnée produit détectée", warnings };
  }

  // 1. Produit / variante / offre
  let product: RawProduct | null = null;
  let offers: RawOffer[] = [];
  if (ld.products.length) {
    const r = resolve(ld.products, finalUrl);
    if ("fail" in r) return { ok: false, reason: r.fail, detail: r.detail, warnings };
    product = r.product;
    offers = r.offers;
    warnings.push(...r.warnings);
  }

  // 2. Identité
  const name = product?.name ?? fb.name;
  if (!name) return { ok: false, reason: "parse_failed", detail: "nom du produit absent", warnings };
  fields.name = product?.name ? "jsonld" : (fb.source.name ?? "html_text");
  const brand = product?.brand ?? fb.brand ?? undefined;
  if (brand) fields.brand = product?.brand ? "jsonld" : hasMicrodata ? "microdata" : "meta";

  const gtinRaw = [...(product?.gtins ?? []), ...fb.gtins];
  const validGtins = [...new Set(gtinRaw.map((g) => normalizeGtin(g)).filter((g): g is string => Boolean(g)))];
  let gtin: string | undefined;
  if (validGtins.length === 1) {
    gtin = validGtins[0];
    fields.gtin = product?.gtins.some((g) => normalizeGtin(g)) ? "jsonld" : "microdata";
  } else if (validGtins.length > 1) warnings.push("gtin_conflict");
  else if (gtinRaw.length) warnings.push("gtin_invalid");

  const mpnA = normalizeMpn(product?.mpn);
  const mpnB = normalizeMpn(fb.mpn);
  let mpn: string | undefined;
  if (mpnA && mpnB && mpnA !== mpnB) warnings.push("mpn_conflict");
  else if (mpnA || mpnB) {
    mpn = mpnA ?? mpnB ?? undefined;
    fields.mpn = mpnA ? "jsonld" : "microdata";
  }
  const model = product?.model ?? undefined;
  if (model) fields.model = "jsonld";

  // 3. Prix : source structurée d'abord, recoupée avec les autres sources
  const offer = offers.find((o) => o.priceCents !== null) ?? offers[0];
  if (offers.some((o) => o.priceRange)) return { ok: false, reason: "ambiguous_variant", detail: "fourchette de prix (AggregateOffer) sans offre détaillée", warnings };
  let priceCents: number | null = null;
  let currency: string | null = null;
  let priceSource: DataSource | null = null;
  if (offer && offer.priceCents !== null) {
    priceCents = offer.priceCents;
    currency = offer.currency;
    priceSource = "jsonld";
  } else if (offer?.priceUnreadable) {
    warnings.push("jsonld_price_unreadable");
  }
  if (fb.priceCents !== null) {
    if (priceCents === null) {
      priceCents = fb.priceCents;
      currency = fb.currency;
      priceSource = fb.source.price as DataSource;
    } else if (fb.priceCents !== priceCents || (fb.currency && currency && fb.currency !== currency)) {
      return { ok: false, reason: "conflicting_data", detail: `prix en désaccord entre jsonld (${priceCents}) et ${fb.source.price} (${fb.priceCents})`, warnings };
    }
  }
  if (priceCents === null || priceSource === null) {
    return { ok: false, reason: "price_not_found", detail: fb.priceUnreadable || offer?.priceUnreadable ? "prix présent mais illisible ou ambigu" : "aucun prix explicite sur la fiche", warnings };
  }
  if (!currency) return { ok: false, reason: "unsupported_currency", detail: "devise absente ou invalide : jamais supposée", warnings };
  fields.price = priceSource;
  fields.currency = priceSource;

  // 4. Disponibilité, état
  const aStruct = mapAvailability(offer?.availability);
  const aFb = mapAvailability(fb.availability);
  let availability: Availability = "unknown";
  if (aStruct && aFb && aStruct.value !== "unknown" && aFb.value !== "unknown" && aStruct.value !== aFb.value) {
    warnings.push("availability_conflict");
  } else {
    const a = aStruct && aStruct.value !== "unknown" ? aStruct : aFb && aFb.value !== "unknown" ? aFb : (aStruct ?? aFb);
    if (a) {
      availability = a.value;
      if (a.warning) warnings.push(a.warning);
      if (a.value !== "unknown") fields.availability = aStruct && aStruct.value !== "unknown" ? "jsonld" : hasMicrodata ? "microdata" : "meta";
    }
  }
  const cond = mapCondition(offer?.condition) ?? mapCondition(product?.condition) ?? mapCondition(fb.condition);
  const condition: ItemCondition = cond ?? "unknown";
  if (cond) fields.condition = offer?.condition || product?.condition ? "jsonld" : hasMicrodata ? "microdata" : "meta";

  // 5. Livraison explicite seulement
  const ship = pickShipping(offers, currency, country, warnings);
  if (ship.listed) fields.shipping = "jsonld";

  // 6. Titre enrichi (variantes déclarées par la fiche)
  const parts = [name];
  const norm = normalizeText(name);
  const add = (v: string | null | undefined, prefix = "") => {
    if (v && !norm.includes(normalizeText(v))) parts.push(`${prefix}${v}`);
  };
  add(model);
  add(product?.color);
  add(product?.size, "taille ");
  for (const p of product?.properties ?? []) if (/capacit|storage|stockage|m[ée]moire|\bram\b|couleur|colou?r|taille|size|version|[ée]dition/i.test(p.name)) add(p.value);
  if (parts.length > 1) fields.variant = "jsonld";
  const title = parts.join(" ").slice(0, 300);

  return {
    ok: true,
    data: {
      name,
      title,
      brand,
      model,
      mpn,
      gtin,
      condition,
      priceCents,
      currency,
      availability,
      shipping: ship.shipping,
      shipsToFrance: ship.ships,
      sellerName: offer?.sellerName ?? undefined,
      priceSource,
      fields,
      warnings: [...new Set(warnings)],
    },
  };
}
