/**
 * Extraction déterministe des caractéristiques d'une fiche à partir de son titre (et des champs structurés).
 * Aucune IA : des règles lisibles, testées. Les champs structurés (GTIN, MPN, état, variante) priment sur le texte.
 */
import { normalizeGtin, normalizeMpn, normalizeText, tokenize } from "./text";
import type { ItemCondition, ProductIdentity, ProductVariant } from "./types";

export interface ListingInput {
  identity: ProductIdentity;
  /** Titre affiché (pour une cible : son nom). */
  title: string;
  /** Texte annexe (extrait de recherche) : utilisé seulement pour repérer un état « reconditionné / occasion ». */
  hintText?: string;
}

export interface Analysis {
  brand: string | null;
  gtin: string | null;
  mpn: string | null;
  variant: ProductVariant;
  condition: ItemCondition;
  accessory: boolean;
  bundle: boolean;
  /** Numéro de génération (« 11e génération », « gen 3 »), s'il est indiqué. */
  generation: number | null;
  /** Millésime (2023…), s'il figure dans le titre. */
  year: number | null;
  /** Mots du modèle sans marque, couleur, capacité, état ni mots publicitaires. */
  modelTokens: string[];
  /** Jetons distinctifs : contiennent un chiffre ou désignent une gamme (pro, max, plus…). */
  discriminating: string[];
  /** Autres mots du modèle (type de produit, désignations générales). */
  core: string[];
  /** Titre normalisé (pour les explications et les contrôles de marque). */
  normalizedTitle: string;
}

const BRAND_ALIASES: Record<string, string> = {
  "hewlett packard": "hp",
  "hewlett-packard": "hp",
  "samsung electronics": "samsung",
  "apple inc": "apple",
  "sony interactive entertainment": "sony",
  "lg electronics": "lg",
  "microsoft corporation": "microsoft",
};
const BRAND_SUFFIX = /\b(inc|ltd|llc|sas|sarl|gmbh|corp|corporation|co|company|france)\b/g;

export function canonicalBrand(raw: string | undefined | null): string | null {
  if (!raw) return null;
  let b = normalizeText(raw).replace(BRAND_SUFFIX, "").replace(/\s+/g, " ").trim();
  b = BRAND_ALIASES[b] ?? b;
  return b || null;
}

const COLORS: Record<string, string> = {
  noir: "noir", black: "noir", noire: "noir", "space gray": "gris", "gris sideral": "gris",
  blanc: "blanc", white: "blanc", blanche: "blanc",
  bleu: "bleu", blue: "bleu", bleue: "bleu",
  rouge: "rouge", red: "rouge",
  vert: "vert", green: "vert", verte: "vert",
  gris: "gris", grey: "gris", gray: "gris", grise: "gris",
  argent: "argent", silver: "argent", argente: "argent",
  or: "or", gold: "or", dore: "or",
  rose: "rose", pink: "rose",
  violet: "violet", purple: "violet", mauve: "violet",
  jaune: "jaune", yellow: "jaune",
  orange: "orange",
  marron: "marron", brown: "marron",
  beige: "beige",
  titane: "titane", titanium: "titane",
};
const COLOR_WORDS = Object.keys(COLORS).sort((a, b) => b.length - a.length);

const NOISE = new Set(
  (
    "neuf neuve neufs livraison gratuit gratuite prix promo promotion offre offres stock disponible achat acheter achetez vente soldes " +
    "pas cher meilleur officiel officielle boutique site france garantie garanti ans an avec sans de du des la le les un une et en pour a au aux d l " +
    "the and with for of new free shipping delivery original authentique certifie livre expedie rapide fr eu"
  ).split(" "),
);

/** Noms génériques de catégorie : leur présence ou absence dans un titre ne distingue pas deux modèles. */
const TYPE_WORDS = new Set(
  "smartphone smartphones telephone mobile portable ordinateur pc tablette liseuse calculatrice casque ecouteurs montre console television tv ecran appareil enceinte aspirateur robot imprimante graphique connectee connecte sans fil bluetooth".split(" "),
);
const LINK_WORDS = new Set(["pour", "compatible", "compatibles", "for", "fits", "adaptable", "adaptables", "destine", "destinee"]);

/** Mots qui désignent une gamme au sein d'un même nom de modèle : les confondre revient à confondre deux produits. */
const TIERS = new Set(["pro", "max", "plus", "mini", "ultra", "lite", "se", "air", "fe", "neo", "xl", "xs", "fold", "flip", "edge", "note", "elite", "prime", "premium"]);

const ROMAN: Record<string, string> = { ii: "2", iii: "3", iv: "4", v: "5", vi: "6", vii: "7", viii: "8", ix: "9" };

const ACCESSORY_NOUNS =
  /\b(coque|coques|etui|etuis|housse|housses|pochette|sacoche|protection|protege|protege-ecran|film|verre trempe|cable|cables|chargeur|chargeurs|adaptateur|adaptateurs|support|supports|dragonne|sangle|bracelet|bracelets|stylet|clavier|case|cover|screen protector|strap|charger|adapter|mount|stand|skin|capot|socle|dock)\b/;
const ACCESSORY_LINK = /\b(pour|compatible|compatibles|for|fits|adaptable|adaptables|destine|destinee)\b/;
const BUNDLE_WORDS = /\b(bundle|coffret|kit|combo|pack)\b(?!\s*(de|x)\s*\d)/;
const BUNDLE_WITH =
  /(?:\bavec\b|\bincluant\b|\binclus\b|\boffert\b|\bwith\b|\s\+\s)\s*(?:une?\s+|un\s+|1\s+)?(?:\w+\s+)?(?:coque|etui|housse|chargeur|cable|ecouteurs|casque|clavier|souris|manette|jeu|carte|sacoche|pochette|stylet|support|film|protection|case|charger|cover|game)/;

function detectCondition(text: string): ItemCondition {
  if (/\b(reconditionn\w*|remis a neuf|refurb\w*|renewed|seconde vie|reconditioned)\b/.test(text)) return "refurbished";
  if (/\b(occasion|d'occasion|used|pre-owned|preowned|second hand|seconde main|comme neuf|tres bon etat|bon etat|etat correct)\b/.test(text)) return "used";
  if (/\b(neuf|neuve|new|sous blister|scelle|scellee|brand new)\b/.test(text)) return "new";
  return "unknown";
}

function detectEdition(text: string): string | undefined {
  const wifi = /\bwi-?fi\b/.test(text);
  const cellular = /\b(cellular|4g|lte)\b/.test(text);
  const gps = /\bgps\b/.test(text);
  if (gps && cellular) return "gps+cellular";
  if (cellular) return "cellular";
  if (/\b5g\b/.test(text)) return "5g";
  if (gps) return "gps";
  if (wifi) return "wifi";
  return undefined;
}

const STORAGE_RE = /\b(\d+(?:\.\d+)?)\s?(to|tb|go|gb)\b/g;

function detectStorageAndRam(text: string): { storageGb?: number; ramGb?: number; rest: string } {
  let storageGb: number | undefined;
  let ramGb: number | undefined;
  const rest = text.replace(STORAGE_RE, (m, value: string, unit: string, offset: number) => {
    const gb = Number(value) * (/^(to|tb)$/.test(unit) ? 1000 : 1);
    const after = text.slice(offset + m.length, offset + m.length + 18);
    const before = text.slice(Math.max(0, offset - 6), offset);
    const isRam = /^\s*(de\s+)?(ram|memoire vive|de memoire)/.test(after) || /ram\s*$/.test(before);
    if (isRam) ramGb ??= gb;
    else storageGb = storageGb === undefined ? gb : Math.max(storageGb, gb);
    return " ";
  });
  return { storageGb, ramGb, rest };
}

function detectSize(text: string): { size?: string; rest: string } {
  let size: string | undefined;
  let rest = text;
  const inch = /\b(\d{1,2}(?:\.\d{1,2})?)\s?(?:"|''|'|pouces?|po|inch(?:es)?)(?=\s|$)/;
  const m1 = rest.match(inch);
  if (m1) {
    size = `inch:${Number(m1[1])}`;
    rest = rest.replace(inch, " ");
  }
  const mm = /\b(\d{2,3})\s?mm\b/;
  const m2 = rest.match(mm);
  if (m2 && !size) {
    size = `mm:${m2[1]}`;
    rest = rest.replace(mm, " ");
  }
  const apparel = /\btaille\s+(xxs|xs|s|m|l|xl|xxl|xxxl)\b/;
  const m3 = rest.match(apparel);
  if (m3 && !size) {
    size = `apparel:${m3[1]}`;
    rest = rest.replace(apparel, " ");
  }
  const eu = /\b(?:taille|pointure|eu)\s+(3[4-9]|4[0-9]|5[0-2])\b/;
  const m4 = rest.match(eu);
  if (m4 && !size) {
    size = `eu:${m4[1]}`;
    rest = rest.replace(eu, " ");
  }
  return { size, rest };
}

function detectQuantity(text: string): { quantity?: number; rest: string } {
  const patterns = [/\b(?:lot|pack|set)\s+de\s+(\d{1,3})\b/, /\b(\d{1,3})\s?(?:pieces|pcs|unites)\b/, /\bx\s?(\d{1,3})\s*$/, /\b(\d{1,3})\s?x\s+(?=[a-z])/];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) {
      const q = Number(m[1]);
      if (q > 1 && q <= 100) return { quantity: q, rest: text.replace(re, " ") };
    }
  }
  return { rest: text };
}

function detectColor(text: string): { color?: string; rest: string } {
  for (const w of COLOR_WORDS) {
    const re = new RegExp(`(?:^|\\s)${w.replace(/\s/g, "\\s")}(?=\\s|$)`);
    if (re.test(text)) return { color: COLORS[w], rest: text.replace(re, " ") };
  }
  return { rest: text };
}

function detectGeneration(text: string): { generation?: number; rest: string } {
  const a = text.match(/\b(\d{1,2})\s?(?:e|eme|er|th|nd|rd|st)?\s?(?:gen\b|generation)/);
  if (a) return { generation: Number(a[1]), rest: text.replace(a[0], " ") };
  const b = text.match(/\b(?:gen\.?|generation)\s?(\d{1,2})\b/);
  if (b) return { generation: Number(b[1]), rest: text.replace(b[0], " ") };
  return { rest: text };
}

export function analyze(input: ListingInput): Analysis {
  const { identity } = input;
  const title = normalizeText(input.title || identity.name);
  const hint = normalizeText(input.hintText ?? "");

  const brand = canonicalBrand(identity.brand);
  const gtin = normalizeGtin(identity.gtin);
  const mpn = normalizeMpn(identity.mpn);

  const accessory = ACCESSORY_NOUNS.test(title) && (ACCESSORY_LINK.test(title) || ACCESSORY_NOUNS.test(title.split(" ").slice(0, 3).join(" ")));
  const bundle = BUNDLE_WORDS.test(title) || BUNDLE_WITH.test(title);

  // Contenu d'un lot (« avec coque et chargeur ») : retiré du nom de modèle pour ne pas le fausser.
  let rest = bundle ? title.replace(/(?:\bavec\b|\bincluant\b|\binclus\b|\boffert\b|\bwith\b|\s\+\s).*$/, " ").replace(/\b(bundle|coffret|kit|combo|pack)\b/g, " ") : title;
  const sr = detectStorageAndRam(rest);
  rest = sr.rest;
  const sz = detectSize(rest);
  rest = sz.rest;
  const q = detectQuantity(rest);
  rest = q.rest;
  const g = detectGeneration(rest);
  rest = g.rest;
  const c = detectColor(rest);
  rest = c.rest;

  const textCondition = detectCondition(title);
  const hintCondition = detectCondition(hint);
  // Un indice « reconditionné / occasion » dans l'extrait l'emporte sur un « neuf » publicitaire du titre.
  const inferredCondition: ItemCondition = hintCondition === "refurbished" || hintCondition === "used" ? hintCondition : textCondition;
  const condition: ItemCondition = identity.condition && identity.condition !== "unknown" ? identity.condition : inferredCondition;
  const edition = identity.variant?.edition ?? detectEdition(title);

  const variant: ProductVariant = {
    storageGb: identity.variant?.storageGb ?? sr.storageGb,
    ramGb: identity.variant?.ramGb ?? sr.ramGb,
    size: identity.variant?.size ?? sz.size,
    color: identity.variant?.color ? (COLORS[normalizeText(identity.variant.color)] ?? normalizeText(identity.variant.color)) : c.color,
    edition,
    quantity: identity.variant?.quantity ?? q.quantity,
  };
  for (const k of Object.keys(variant) as Array<keyof ProductVariant>) if (variant[k] === undefined) delete variant[k];

  const brandTokens = new Set(brand ? tokenize(brand) : []);
  const cleaned = rest
    .replace(/\b(reconditionn\w*|remis a neuf|refurb\w*|renewed|seconde vie|reconditioned|occasion|d'occasion|used|pre-owned|comme neuf|tres bon etat|bon etat)\b/g, " ")
    .replace(/\bwi-?fi\b|\b(cellular|4g|lte|5g|gps)\b/g, " ");
  const modelTokens = tokenize(cleaned)
    .map((t) => ROMAN[t] ?? t)
    .filter((t) => t.length > 0 && !NOISE.has(t) && !LINK_WORDS.has(t) && !TYPE_WORDS.has(t) && !brandTokens.has(t));
  const year = (() => {
    const y = modelTokens.find((t) => /^20\d\d$/.test(t));
    return y ? Number(y) : null;
  })();
  const tokens = modelTokens.filter((t) => !/^20\d\d$/.test(t));
  const discriminating = tokens.filter((t) => /\d/.test(t) || TIERS.has(t));
  const core = tokens.filter((t) => !discriminating.includes(t));
  return {
    brand,
    gtin,
    mpn,
    variant,
    condition,
    accessory,
    bundle,
    generation: g.generation ?? null,
    year,
    modelTokens: tokens,
    discriminating,
    core,
    normalizedTitle: title,
  };
}
