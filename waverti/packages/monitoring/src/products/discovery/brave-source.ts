/**
 * Source de découverte Brave : implémente `OfferDiscoverySource`. Une instance sert UNE recherche d'utilisateur
 * (elle porte son quota) ; les compteurs de `stats` distinguent trois choses qu'il ne faut pas confondre :
 *   - recherche utilisateur : une demande « trouver ce produit » (userSearches) ;
 *   - appel API : une requête réellement émise vers Brave et facturée (apiCalls) — 0 si cache ou requête fusionnée ;
 *   - vérification HTTP : l'ouverture d'une fiche marchande, comptée par le vérificateur, jamais ici.
 * Un résultat Brave n'est jamais un prix : seuls titre, extrait et adresse sont retenus.
 */
import type { DiscoveryQuery, OfferDiscoverySource } from "../pipeline";
import type { OfferCandidate } from "../types";
import { prefilterResults, type Dropped, type DropReason } from "./filter";
import type { BraveRequester, BraveSearchGateway } from "./gateway";
import { buildProductQueries } from "./query";

export interface BraveDiscoveryOptions {
  gateway: BraveSearchGateway;
  requester: BraveRequester;
  /** Requêtes au plus par recherche d'utilisateur (la seconde n'est lancée que si la première ne suffit pas). */
  maxQueries?: number;
  /** Nombre de résultats exploitables au-delà duquel on n'émet pas de requête supplémentaire. */
  enoughCandidates?: number;
  now?: () => Date;
}

export interface BraveDiscoveryStats {
  userSearches: number;
  queries: number;
  apiCalls: number;
  cacheHits: number;
  sharedRequests: number;
  rawResults: number;
  kept: number;
  dropped: Record<DropReason, number>;
}

const emptyDropped = (): Record<DropReason, number> => ({ invalid_url: 0, duplicate: 0, non_merchant_host: 0, not_product_page: 0, accessory: 0, different_product: 0, variant: 0 });

export class BraveOfferDiscoverySource implements OfferDiscoverySource {
  readonly name = "brave";
  readonly stats: BraveDiscoveryStats = { userSearches: 0, queries: 0, apiCalls: 0, cacheHits: 0, sharedRequests: 0, rawResults: 0, kept: 0, dropped: emptyDropped() };
  readonly droppedDetails: Dropped[] = [];
  readonly queriesUsed: string[] = [];

  constructor(private readonly o: BraveDiscoveryOptions) {}

  async discover(query: DiscoveryQuery): Promise<OfferCandidate[]> {
    this.stats.userSearches++;
    const queries = buildProductQueries(query.target, { maxQueries: this.o.maxQueries });
    const enough = this.o.enoughCandidates ?? 5;
    const now = (this.o.now ?? (() => new Date()))();
    const kept = new Map<string, OfferCandidate>();
    const seenKeys = new Set<string>();

    for (const q of queries) {
      const res = await this.o.gateway.search(q, this.o.requester);
      this.queriesUsed.push(q);
      this.stats.queries++;
      this.stats.apiCalls += res.apiCalls;
      if (res.fromCache) this.stats.cacheHits++;
      if (res.shared) this.stats.sharedRequests++;
      this.stats.rawResults += res.items.length;
      // Les adresses déjà retenues par une requête précédente comptent comme doublons.
      const fresh = res.items.filter((i) => !seenKeys.has(i.url));
      for (const i of res.items) seenKeys.add(i.url);
      const out = prefilterResults(query.target, fresh, { now, discoveredBy: "brave" });
      for (const d of out.dropped) {
        this.stats.dropped[d.reason]++;
        this.droppedDetails.push(d);
      }
      this.stats.dropped.duplicate += res.items.length - fresh.length;
      for (const k of out.kept) if (!kept.has(k.candidate.url)) kept.set(k.candidate.url, k.candidate);
      // Assez de candidats précis : inutile (et coûteux) d'élargir la recherche.
      const precise = out.kept.filter((k) => !k.match.inconclusive).length;
      if (kept.size >= enough && precise > 0) break;
    }
    const list = [...kept.values()].slice(0, query.limit);
    this.stats.kept = list.length;
    return list;
  }
}
