/**
 * Pipeline de comparaison : découverte → dédoublonnage → pré-filtrage sur titre → vérification des fiches →
 * rapprochement définitif → rapport. Le moteur ne connaît que deux « ports » (découverte, vérification) : brancher
 * Brave Search et les vérifications HTTP réelles consiste à les implémenter, sans toucher au rapprochement.
 *
 * Garanties :
 *  - un résultat de recherche (titre, extrait) ne produit jamais de prix, de stock ni d'alerte ;
 *  - une vérification échouée (bloquée, expirée…) est rapportée comme telle, jamais comme rupture ou baisse de prix ;
 *  - les budgets (candidats, vérifications) sont des paramètres, et leur épuisement est signalé.
 */
import { assessOffer, type IneligibleReason, type OfferAssessment } from "./match";
import { compareListings } from "./match";
import { canonicalizeUrl } from "./text";
import { identityFromCandidateTitle } from "./identity";
import type { MatchResult, OfferCandidate, ProductTarget, VerificationFailure, VerifiedOffer } from "./types";

/** Requête de découverte construite à partir de la cible (le port décide comment l'exprimer à son moteur). */
export interface DiscoveryQuery {
  target: ProductTarget;
  /** Texte de recherche prêt à l'emploi (« NumWorks calculatrice N0120 neuf »). */
  text: string;
  limit: number;
}

export interface OfferDiscoverySource {
  readonly name: string;
  discover(query: DiscoveryQuery): Promise<OfferCandidate[]>;
}

export interface OfferVerifier {
  verify(candidate: OfferCandidate): Promise<{ ok: true; offer: VerifiedOffer } | VerificationFailure>;
}

export interface ComparisonLimits {
  /** Candidats conservés après dédoublonnage. */
  maxCandidates: number;
  /** Fiches ouvertes au plus (chaque vérification coûte une requête HTTP). */
  maxVerifications: number;
  /** Au-delà, une offre est signalée « périmée » (le prix affiché n'est plus garanti frais). */
  maxOfferAgeMs: number;
}

export const DEFAULT_LIMITS: ComparisonLimits = { maxCandidates: 40, maxVerifications: 12, maxOfferAgeMs: 24 * 3600_000 };

export interface ScoredOffer {
  offer: VerifiedOffer;
  match: MatchResult;
  landedPriceCents: number | null;
  stale: boolean;
}

export interface RejectedCandidate {
  url: string;
  title: string;
  stage: "discovery" | "verified";
  match: MatchResult;
}

export interface ComparisonReport {
  /** Même produit (exact ou probable), éligibles à la cible, vérifiés. Triés par prix article croissant, par devise. */
  matches: ScoredOffer[];
  /** Même modèle mais autre caractéristique (capacité, taille, état, lot…) : proposé à part, jamais mélangé. */
  variants: ScoredOffer[];
  /** Autre produit, accessoire, génération différente… */
  rejected: RejectedCandidate[];
  /** Même produit mais hors cible (devise étrangère, non livrable en France…). */
  ineligible: Array<{ offer: VerifiedOffer; match: MatchResult; reasons: IneligibleReason[] }>;
  /** Fiches non vérifiables : motif connu, aucune donnée de prix ou de stock retenue. */
  unverifiable: VerificationFailure[];
  /** Titres trop vagues pour décider, ou non vérifiés faute de budget. */
  uncertain: Array<{ url: string; title: string; reason: "inconclusive" | "budget"; match: MatchResult }>;
  sourceErrors: Array<{ source: string; message: string }>;
  stats: { discovered: number; unique: number; verified: number; budgetExhausted: boolean };
  /** Meilleur prix article par devise, parmi les offres retenues (frais éventuellement inconnus). */
  bestItemPrice: Record<string, ScoredOffer | undefined>;
  /** Meilleur prix livré par devise : uniquement parmi les offres dont les frais sont connus. */
  bestLandedPrice: Record<string, ScoredOffer | undefined>;
}

export interface ComparisonDeps {
  sources: OfferDiscoverySource[];
  verifier: OfferVerifier;
  limits?: Partial<ComparisonLimits>;
  now?: () => Date;
}

export function buildSearchText(target: ProductTarget): string {
  const id = target.identity;
  const parts = [id.brand, id.name, id.mpn, target.condition === "new" ? "neuf" : target.condition === "refurbished" ? "reconditionné" : "occasion"];
  return parts.filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}

/** Dédoublonne par URL canonique (les paramètres de suivi sont retirés) ; garde la première occurrence. */
export function dedupeCandidates(candidates: OfferCandidate[]): OfferCandidate[] {
  const seen = new Set<string>();
  const out: OfferCandidate[] = [];
  for (const c of candidates) {
    const key = canonicalizeUrl(c.url);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push({ ...c, url: key });
  }
  return out;
}

/** Un vendeur ne figure qu'une fois par produit identique : on garde l'offre la moins chère (puis la plus récente). */
export function dedupeBySeller(offers: ScoredOffer[]): ScoredOffer[] {
  const best = new Map<string, ScoredOffer>();
  for (const s of offers) {
    const key = `${s.offer.seller.key}|${s.offer.currency}|${JSON.stringify(s.offer.product.variant ?? {})}|${s.offer.product.condition ?? ""}`;
    const cur = best.get(key);
    if (!cur || s.offer.priceCents < cur.offer.priceCents || (s.offer.priceCents === cur.offer.priceCents && s.offer.checkedAt > cur.offer.checkedAt)) best.set(key, s);
  }
  return [...best.values()];
}

const byPrice = (a: ScoredOffer, b: ScoredOffer) => a.offer.priceCents - b.offer.priceCents || a.offer.seller.key.localeCompare(b.offer.seller.key);

export async function compareProduct(target: ProductTarget, deps: ComparisonDeps): Promise<ComparisonReport> {
  const limits: ComparisonLimits = { ...DEFAULT_LIMITS, ...deps.limits };
  const now = (deps.now ?? (() => new Date()))();
  const report: ComparisonReport = {
    matches: [],
    variants: [],
    rejected: [],
    ineligible: [],
    unverifiable: [],
    uncertain: [],
    sourceErrors: [],
    stats: { discovered: 0, unique: 0, verified: 0, budgetExhausted: false },
    bestItemPrice: {},
    bestLandedPrice: {},
  };

  // 1. Découverte : l'échec d'une source n'arrête pas les autres.
  const all: OfferCandidate[] = [];
  const query: DiscoveryQuery = { target, text: buildSearchText(target), limit: limits.maxCandidates };
  for (const source of deps.sources) {
    try {
      all.push(...(await source.discover(query)));
    } catch (err) {
      report.sourceErrors.push({ source: source.name, message: (err as Error).message.slice(0, 200) });
    }
  }
  report.stats.discovered = all.length;
  const unique = dedupeCandidates(all).slice(0, limits.maxCandidates);
  report.stats.unique = unique.length;

  // 2. Pré-filtrage sur le titre (aucune requête réseau) : écarte accessoires, autres modèles, autres variantes.
  const targetListing = { identity: { ...target.identity, condition: target.condition }, title: target.identity.name };
  const toVerify: Array<{ c: OfferCandidate; match: MatchResult }> = [];
  for (const c of unique) {
    const match = compareListings(targetListing, { identity: identityFromCandidateTitle(c.title), title: c.title, hintText: c.snippet });
    if (match.verdict === "exact" || match.verdict === "probable") toVerify.push({ c, match });
    else if (match.verdict === "different" && match.inconclusive) toVerify.push({ c, match });
    else if (match.verdict === "variant") {
      // Variante annoncée par le titre (autre capacité, état…) : écartée sans ouvrir la fiche.
      report.rejected.push({ url: c.url, title: c.title, stage: "discovery", match });
    } else report.rejected.push({ url: c.url, title: c.title, stage: "discovery", match });
  }
  // Les plus prometteurs d'abord : le budget de vérifications est consommé dans cet ordre.
  toVerify.sort((x, y) => Number(x.match.inconclusive) - Number(y.match.inconclusive) || y.match.confidence - x.match.confidence);

  // 3. Vérification des fiches, dans la limite du budget.
  const verified: ScoredOffer[] = [];
  let used = 0;
  for (const { c, match } of toVerify) {
    if (used >= limits.maxVerifications) {
      report.stats.budgetExhausted = true;
      report.uncertain.push({ url: c.url, title: c.title, reason: "budget", match });
      continue;
    }
    used++;
    const outcome = await deps.verifier.verify(c).catch(
      (): VerificationFailure => ({ ok: false, url: c.url, reason: "parse_failed", transient: true, checkedAt: now }),
    );
    if (!outcome.ok) {
      report.unverifiable.push(outcome);
      continue;
    }
    report.stats.verified++;
    const assessed: OfferAssessment = assessOffer(target, outcome.offer);
    const stale = now.getTime() - outcome.offer.checkedAt.getTime() > limits.maxOfferAgeMs;
    const scored: ScoredOffer = { offer: outcome.offer, match: assessed.match, landedPriceCents: assessed.landedPriceCents, stale };
    switch (assessed.match.verdict) {
      case "exact":
      case "probable":
        if (assessed.ineligible.length) report.ineligible.push({ offer: outcome.offer, match: assessed.match, reasons: assessed.ineligible });
        else verified.push(scored);
        break;
      case "variant":
        report.variants.push(scored);
        break;
      default:
        if (assessed.match.inconclusive) report.uncertain.push({ url: outcome.offer.url, title: outcome.offer.title, reason: "inconclusive", match: assessed.match });
        else report.rejected.push({ url: outcome.offer.url, title: outcome.offer.title, stage: "verified", match: assessed.match });
    }
  }

  // 4. Un vendeur une seule fois, tri par prix, meilleurs prix par devise (jamais de conversion).
  report.matches = dedupeBySeller(verified).sort(byPrice);
  report.variants = dedupeBySeller(report.variants).sort(byPrice);
  for (const s of report.matches) {
    const cur = s.offer.currency;
    const best = report.bestItemPrice[cur];
    if (!best || s.offer.priceCents < best.offer.priceCents) report.bestItemPrice[cur] = s;
    if (s.landedPriceCents !== null) {
      const bl = report.bestLandedPrice[cur];
      if (!bl || s.landedPriceCents < (bl.landedPriceCents ?? Infinity)) report.bestLandedPrice[cur] = s;
    }
  }
  return report;
}
