/**
 * Modèle de produit et d'offre pour la comparaison multi-boutiques (lot 1).
 *
 * Aucune dépendance réseau ni base de données : ces types décrivent ce que les sources (recherche Web, vérification
 * HTTP des fiches) devront fournir, et ce que le moteur de rapprochement renvoie. Voir `match.ts` pour les règles.
 */

/** État du produit proposé. « unknown » : non indiqué par la fiche (jamais supposé « neuf »). */
export type ItemCondition = "new" | "refurbished" | "used" | "unknown";

export type Availability = "in_stock" | "out_of_stock" | "preorder" | "limited" | "unknown";

/** Caractéristiques qui distinguent des variantes d'un même modèle. Une valeur absente = non précisée (≠ différente). */
export interface ProductVariant {
  /** Stockage en Go (1 To = 1000 Go). */
  storageGb?: number;
  /** Mémoire vive en Go. */
  ramGb?: number;
  /** Taille normalisée : « inch:6.1 », « mm:44 », « apparel:m », « eu:42 ». */
  size?: string;
  /** Couleur normalisée (noir, blanc, argent…). */
  color?: string;
  /** Version / connectivité normalisée : « wifi », « cellular », « 5g », « gps »… */
  edition?: string;
  /** Nombre d'unités vendues dans l'offre (lot de 2 → 2). Absent = 1. */
  quantity?: number;
}

/** Identification d'un produit. Tous les champs sont facultatifs : plus il y en a, plus le rapprochement est sûr. */
export interface ProductIdentity {
  brand?: string;
  /** Nom / modèle lisible (« NumWorks calculatrice graphique »). */
  name: string;
  /** Référence fabricant (Manufacturer Part Number). */
  mpn?: string;
  /** GTIN / EAN / UPC (8, 12, 13 ou 14 chiffres). Un GTIN dont la clé de contrôle est fausse est ignoré. */
  gtin?: string;
  variant?: ProductVariant;
  condition?: ItemCondition;
}

export type ShippingCost =
  | { kind: "free" }
  | { kind: "known"; cents: number }
  /** Frais non indiqués ou non vérifiables : jamais remplacés par 0. */
  | { kind: "unknown" }
  /** Livraison indiquée comme impossible vers la destination demandée. */
  | { kind: "unavailable" };

export interface Seller {
  /** Clé stable (domaine normalisé, + vendeur tiers éventuel) servant au dédoublonnage. */
  key: string;
  name: string;
  /** Vendeur tiers d'une place de marché (le site est alors la place de marché). */
  marketplaceSeller?: string;
}

/** Résultat brut d'une recherche (non vérifié) : titre et extrait seulement. Aucun prix n'en est jamais retenu. */
export interface OfferCandidate {
  url: string;
  title: string;
  snippet?: string;
  /** Source de découverte (« brave », « simulated »…). */
  discoveredBy: string;
  discoveredAt: Date;
}

/** Offre vérifiée sur la fiche publique elle-même. */
export interface VerifiedOffer {
  url: string;
  canonicalUrl: string;
  seller: Seller;
  /** Identification lue sur la fiche (données structurées, titre). */
  product: ProductIdentity;
  /** Texte du titre de la fiche (conservé pour expliquer le rapprochement). */
  title: string;
  /** Prix de l'article en centimes, dans la devise indiquée. Jamais converti. */
  priceCents: number;
  currency: string;
  availability: Availability;
  shipping: ShippingCost;
  /** Frais ou taxes à ajouter inconnus : le prix « livré » n'est alors pas calculable. */
  checkedAt: Date;
  /** Offre signalée comme livrable en France (null = inconnu). */
  shipsToFrance: boolean | null;
}

export type VerificationFailureReason = "blocked" | "timeout" | "not_found" | "not_a_product_page" | "parse_failed" | "unsupported_currency" | "robots_disallowed";

export interface VerificationFailure {
  ok: false;
  url: string;
  reason: VerificationFailureReason;
  /** Échec temporaire : à réessayer plus tard. Dans tous les cas, jamais interprété comme une rupture ou une baisse de prix. */
  transient: boolean;
  checkedAt: Date;
}

export type VerificationOutcome = { ok: true; offer: VerifiedOffer } | VerificationFailure;

/** Ce que l'utilisateur a confirmé : le produit visé et ses exigences. */
export interface ProductTarget {
  identity: ProductIdentity;
  /** État exigé. Par défaut « new » : le reconditionné et l'occasion sont écartés. */
  condition: Exclude<ItemCondition, "unknown">;
  /** Devise acceptée (v1 : EUR seulement). */
  currency: string;
  /** Pays de livraison demandé (v1 : FR). */
  country: string;
}

export type MatchVerdict = "exact" | "probable" | "variant" | "different";

/** Motifs normalisés, utilisables par l'interface et les alertes (jamais du texte libre en logique). */
export type MatchReason =
  | "gtin_equal"
  | "gtin_differs"
  | "mpn_equal"
  | "mpn_differs"
  | "brand_equal"
  | "brand_differs"
  | "brand_missing"
  | "model_equal"
  | "model_similar"
  | "model_differs"
  | "generation_differs"
  | "tier_differs"
  | "accessory"
  | "bundle"
  | "quantity_differs"
  | "storage_differs"
  | "ram_differs"
  | "size_differs"
  | "color_differs"
  | "edition_differs"
  | "condition_differs"
  | "condition_unknown"
  | "attribute_missing"
  | "identifier_contradiction"
  | "no_identifier";

export interface MatchResult {
  verdict: MatchVerdict;
  /** 0..1. « exact » exige une preuve d'identifiant (GTIN ou MPN) et aucune contradiction. */
  confidence: number;
  reasons: MatchReason[];
  /** Dimensions qui différent, quand le verdict est « variant » (ex. « storage »). */
  differingDimensions: string[];
  /**
   * Vrai quand « different » vient d'un manque de preuves (titre trop vague), pas d'une différence constatée :
   * l'offre est alors à écarter de la comparaison mais à signaler comme « non déterminée ».
   */
  inconclusive: boolean;
  /** Phrase en français destinée à l'utilisateur. */
  explanation: string;
}
