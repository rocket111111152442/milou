/**
 * Moteur de rapprochement : deux fiches décrivent-elles le même produit ?
 *
 * Verdicts : « exact » (preuve d'identifiant), « probable » (mêmes identifiants textuels, preuve incomplète),
 * « variant » (même modèle, caractéristique différente : capacité, taille, couleur, état, lot…) et « different »
 * (autre produit : accessoire, génération ou gamme différente, autre marque…). Voir docs/PRODUITS.md pour les règles.
 *
 * Principes : une différence constatée ne se compense jamais par un bon score ; une caractéristique absente d'un côté
 * réduit la confiance mais ne crée pas de différence ; « exact » exige un GTIN ou une référence fabricant identique.
 */
import { analyze, type Analysis, type ListingInput } from "./attributes";
import type { Availability, ItemCondition, MatchReason, MatchResult, MatchVerdict, ProductTarget, VerifiedOffer } from "./types";
import { tokenize } from "./text";

/** Seuils (documentés et testés). */
export const MATCH_THRESHOLDS = {
  exactGtin: 0.97,
  exactMpn: 0.93,
  /** En dessous, la preuve textuelle est jugée insuffisante : « different » avec `inconclusive`. */
  probableMin: 0.55,
  textBase: 0.78,
  missingPenalty: 0.06,
  brandMissingPenalty: 0.1,
  conditionUnknownCap: 0.8,
  contradictionCap: 0.55,
} as const;

const DIMENSIONS = [
  { key: "storageGb", dim: "storage", reason: "storage_differs" },
  { key: "ramGb", dim: "ram", reason: "ram_differs" },
  { key: "size", dim: "size", reason: "size_differs" },
  { key: "color", dim: "color", reason: "color_differs" },
  { key: "edition", dim: "edition", reason: "edition_differs" },
] as const satisfies ReadonlyArray<{ key: keyof Analysis["variant"]; dim: string; reason: MatchReason }>;

const DIM_LABEL: Record<string, string> = {
  storage: "capacité de stockage",
  ram: "mémoire vive",
  size: "taille",
  color: "couleur",
  edition: "version",
  quantity: "quantité (lot)",
  condition: "état (neuf, reconditionné, occasion)",
  bundle: "contenu (produit seul ou lot avec accessoires)",
  sku: "référence exacte",
};

const jaccard = (a: string[], b: string[]): number => {
  const A = new Set(a);
  const B = new Set(b);
  if (!A.size && !B.size) return 1;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return inter / (A.size + B.size - inter);
};
const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));
const clamp = (n: number) => Math.max(0, Math.min(1, Math.round(n * 100) / 100));

function result(verdict: MatchVerdict, confidence: number, reasons: MatchReason[], dims: string[], explanation: string, inconclusive = false): MatchResult {
  return { verdict, confidence: clamp(confidence), reasons: [...new Set(reasons)], differingDimensions: dims, inconclusive, explanation };
}

/** Retire des jetons du modèle ceux qui sont la marque de l'un ou l'autre côté (un titre peut la citer, l'autre pas). */
function stripBrands(a: Analysis, b: Analysis) {
  const brandTokens = new Set([...(a.brand ? tokenize(a.brand) : []), ...(b.brand ? tokenize(b.brand) : [])]);
  const f = (t: string[]) => t.filter((x) => !brandTokens.has(x));
  return {
    aDisc: f(a.discriminating),
    bDisc: f(b.discriminating),
    aCore: f(a.core),
    bCore: f(b.core),
  };
}

export function compareListings(left: ListingInput, right: ListingInput): MatchResult {
  const a = analyze(left);
  const b = analyze(right);
  const reasons: MatchReason[] = [];

  // 1. Accessoire contre produit : jamais comparables (un étui ne remplace pas l'appareil).
  if (a.accessory !== b.accessory) {
    return result("different", 0.05, ["accessory"], [], "L'un des deux articles est un accessoire (étui, câble, chargeur…), pas le produit lui-même.");
  }

  // 2–3. Conflits de marque ou de modèle : arrêtent le rapprochement, sauf si un GTIN valide identique prouve le contraire
  // (le cas échéant, ils sont rapportés comme contradiction et la correspondance reste incertaine).
  let conflict: { reason: MatchReason; explanation: string } | null = null;
  const brandsKnown = a.brand && b.brand;
  const brandCited = (x: Analysis, other: Analysis) => Boolean(x.brand && other.normalizedTitle.split(" ").some((t) => tokenize(x.brand!).includes(t)));
  if (brandsKnown && a.brand !== b.brand && !brandCited(a, b) && !brandCited(b, a)) {
    conflict = { reason: "brand_differs", explanation: "Les marques indiquées sont différentes." };
  }
  const brandEqual = Boolean(brandsKnown && a.brand === b.brand) || brandCited(a, b) || brandCited(b, a);
  reasons.push(brandEqual ? "brand_equal" : "brand_missing");

  const { aDisc, bDisc, aCore, bCore } = stripBrands(a, b);
  let modelState: "equal" | "similar" | "missing" | "differs" = "equal";
  if (!conflict && a.generation !== null && b.generation !== null && a.generation !== b.generation) {
    conflict = { reason: "generation_differs", explanation: `Générations différentes (${a.generation} et ${b.generation}) : ce ne sont pas les mêmes produits.` };
  }
  if (!conflict && a.year !== null && b.year !== null && a.year !== b.year) {
    conflict = { reason: "generation_differs", explanation: `Millésimes différents (${a.year} et ${b.year}) : ce ne sont pas les mêmes produits.` };
  }
  if (aDisc.length && bDisc.length) {
    if (!conflict && !sameSet(aDisc, bDisc)) {
      const tierOnly = [...aDisc, ...bDisc].filter((t) => !aDisc.includes(t) || !bDisc.includes(t)).every((t) => !/\d/.test(t));
      conflict = {
        reason: tierOnly ? "tier_differs" : "model_differs",
        explanation: tierOnly ? "Gammes différentes (par exemple « Pro » et « Max » ou version standard)." : "Les références du modèle sont différentes.",
      };
    }
    // Mêmes références distinctives : des mots descriptifs en plus ou en moins (« lycée », « calculator ») n'y changent rien,
    // sauf si les deux côtés en ont et qu'ils n'ont presque rien en commun.
    const j = jaccard(aCore, bCore);
    modelState = j >= 0.99 ? "equal" : !aCore.length || !bCore.length || j >= 0.34 ? "similar" : "differs";
  } else if (aDisc.length || bDisc.length) {
    modelState = "missing";
  } else {
    const j = jaccard(aCore, bCore);
    modelState = j >= 0.99 ? "equal" : j >= 0.8 ? "similar" : "differs";
  }
  if ((a.generation === null) !== (b.generation === null)) modelState = modelState === "equal" || modelState === "similar" ? "missing" : modelState;
  if (!conflict && modelState === "differs") conflict = { reason: "model_differs", explanation: "Les noms de modèle ne correspondent pas." };

  // 4. Identifiants.
  const gtinEqual = a.gtin !== null && a.gtin === b.gtin;
  const gtinDiffers = a.gtin !== null && b.gtin !== null && a.gtin !== b.gtin;
  const mpnEqual = a.mpn !== null && a.mpn === b.mpn;
  const mpnDiffers = a.mpn !== null && b.mpn !== null && a.mpn !== b.mpn;
  if (conflict) {
    if (gtinEqual) {
      // Même code-barres mais titres ou marques incompatibles : donnée probablement erronée chez l'un des marchands.
      return result("probable", MATCH_THRESHOLDS.contradictionCap - 0.05, [...reasons, "gtin_equal", conflict.reason, "identifier_contradiction"], [], `Même code-barres, mais ${conflict.explanation.charAt(0).toLowerCase()}${conflict.explanation.slice(1)} Correspondance incertaine.`);
    }
    return result("different", 0.05, [...reasons, conflict.reason], [], conflict.explanation);
  }
  if (modelState === "equal") reasons.push("model_equal");
  else if (modelState === "similar") reasons.push("model_similar");
  if (gtinEqual) reasons.push("gtin_equal");
  if (gtinDiffers) reasons.push("gtin_differs");
  if (mpnEqual) reasons.push("mpn_equal");
  if (mpnDiffers) reasons.push("mpn_differs");
  const contradiction = (gtinEqual && mpnDiffers) || (mpnEqual && gtinDiffers);

  // 5. Caractéristiques de variante : différence constatée seulement si les deux côtés l'indiquent.
  const dims: string[] = [];
  let missing = 0;
  for (const { key, dim, reason } of DIMENSIONS) {
    const x = a.variant[key];
    const y = b.variant[key];
    if (x !== undefined && y !== undefined) {
      if (x !== y) {
        dims.push(dim);
        reasons.push(reason);
      }
    } else if (x !== undefined || y !== undefined) {
      if (key !== "color") missing++;
      else missing += 0.5;
    }
  }
  const qa = a.variant.quantity ?? 1;
  const qb = b.variant.quantity ?? 1;
  if (qa !== qb) {
    dims.push("quantity");
    reasons.push("quantity_differs");
  }
  if (a.bundle !== b.bundle) {
    dims.push("bundle");
    reasons.push("bundle");
  }
  // État : deux états connus et différents = variante ; un état inconnu limite la confiance (jamais supposé « neuf »).
  let conditionUnknown = false;
  if (a.condition !== "unknown" && b.condition !== "unknown") {
    if (a.condition !== b.condition) {
      dims.push("condition");
      reasons.push("condition_differs");
    }
  } else if (a.condition !== b.condition) {
    conditionUnknown = true;
    reasons.push("condition_unknown");
  }
  if (missing > 0) reasons.push("attribute_missing");

  // 6. Preuve d'identité.
  const proof: "gtin" | "mpn" | null = gtinEqual ? "gtin" : mpnEqual && (brandEqual || !brandsKnown) ? "mpn" : null;
  let confidence: number;
  let base: MatchVerdict;
  if (proof && !contradiction) {
    base = proof === "gtin" || brandEqual ? "exact" : "probable";
    confidence = proof === "gtin" ? MATCH_THRESHOLDS.exactGtin : MATCH_THRESHOLDS.exactMpn;
    if (!brandEqual && proof === "mpn") confidence -= MATCH_THRESHOLDS.brandMissingPenalty;
  } else if (proof && contradiction) {
    base = "probable";
    confidence = MATCH_THRESHOLDS.contradictionCap;
    reasons.push("identifier_contradiction");
  } else if ((gtinDiffers || mpnDiffers) && (modelState === "equal" || modelState === "similar")) {
    // Même modèle apparent mais références différentes : autre déclinaison commerciale (couleur, lot, marché…).
    if (!dims.length) dims.push("sku");
    base = "probable";
    confidence = MATCH_THRESHOLDS.textBase;
  } else if (modelState === "missing") {
    return result("different", 0.3, [...reasons, "no_identifier", "attribute_missing"], [], "Informations insuffisantes pour affirmer qu'il s'agit du même modèle (référence ou génération absente d'un côté).", true);
  } else {
    base = "probable";
    confidence = MATCH_THRESHOLDS.textBase + (modelState === "equal" ? 0.04 : -0.06);
    if (!brandEqual) confidence -= MATCH_THRESHOLDS.brandMissingPenalty;
    reasons.push("no_identifier");
  }
  confidence -= missing * MATCH_THRESHOLDS.missingPenalty;
  // État inconnu d'un côté : l'identité du produit n'est pas en cause, mais la confiance baisse légèrement.
  // L'exigence « neuf » de la cible est appliquée par assessOffer (jamais supposé neuf).
  if (conditionUnknown) confidence -= MATCH_THRESHOLDS.missingPenalty / 2;

  if (base === "probable" && confidence < MATCH_THRESHOLDS.probableMin) {
    return result("different", confidence, reasons, [], "Preuves trop faibles pour rapprocher ces deux fiches.", true);
  }
  if (dims.length) {
    const labels = dims.map((d) => DIM_LABEL[d] ?? d).join(", ");
    return result("variant", confidence, reasons, dims, `Même modèle, mais différence : ${labels}.`);
  }
  const explanation =
    base === "exact"
      ? proof === "gtin"
        ? "Même code-barres (GTIN) : même produit."
        : "Même référence fabricant et même marque : même produit."
      : contradiction
        ? "Identifiants en conflit avec le titre : correspondance incertaine."
        : conditionUnknown
          ? "Même modèle apparent, mais l'état (neuf, reconditionné…) n'est pas indiqué."
          : "Même marque et même modèle d'après le titre, sans référence commune pour le prouver.";
  return result(base, confidence, reasons, [], explanation);
}

// ———————————————————————————— Cible utilisateur et offre vérifiée ————————————————————————————

export type IneligibleReason = "currency" | "not_deliverable" | "invalid_price";

export interface OfferAssessment {
  match: MatchResult;
  /** Conditions de la cible non remplies (devise, livraison…) : l'offre est écartée de la comparaison mais conservée. */
  ineligible: IneligibleReason[];
  /** Prix article + livraison, uniquement si les frais sont connus ; sinon null (jamais un faux prix « livré »). */
  landedPriceCents: number | null;
}

export function landedPrice(offer: Pick<VerifiedOffer, "priceCents" | "shipping">): number | null {
  switch (offer.shipping.kind) {
    case "free":
      return offer.priceCents;
    case "known":
      return offer.priceCents + offer.shipping.cents;
    default:
      return null;
  }
}

/** Confronte une offre vérifiée à la cible : rapprochement du produit + exigences de la cible (état, devise, livraison). */
export function assessOffer(target: ProductTarget, offer: VerifiedOffer): OfferAssessment {
  const targetListing: ListingInput = { identity: { ...target.identity, condition: target.condition }, title: target.identity.name };
  const offerListing: ListingInput = { identity: offer.product, title: offer.title };
  let match = compareListings(targetListing, offerListing);
  // La cible exige un état précis : une fiche qui ne l'indique pas ne peut pas être présentée comme « exacte ».
  if (match.reasons.includes("condition_unknown") && (match.verdict === "exact" || match.verdict === "probable")) {
    match = {
      ...match,
      verdict: "probable",
      confidence: Math.min(match.confidence, MATCH_THRESHOLDS.conditionUnknownCap),
      explanation: `${match.explanation} L'état (${target.condition === "new" ? "neuf" : target.condition}) n'est pas indiqué sur la fiche.`,
    };
  }
  const ineligible: IneligibleReason[] = [];
  if (offer.currency.toUpperCase() !== target.currency.toUpperCase()) ineligible.push("currency");
  if (offer.shipsToFrance === false || offer.shipping.kind === "unavailable") ineligible.push("not_deliverable");
  if (!Number.isFinite(offer.priceCents) || offer.priceCents <= 0) ineligible.push("invalid_price");
  return { match, ineligible, landedPriceCents: landedPrice(offer) };
}

/** Disponibilité exploitable pour une alerte « en stock » : les états douteux ne sont jamais présentés comme du stock. */
export function isPurchasable(a: Availability): boolean {
  return a === "in_stock" || a === "limited";
}

export type { ItemCondition };
