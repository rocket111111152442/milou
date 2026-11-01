/**
 * Sources SIMULÉES (lot 1) : un faux « moteur de recherche » et un faux vérificateur de fiches, alimentés par un
 * catalogue de pages fictives. Elles ne font aucun appel réseau et servent aux tests et aux démonstrations. Les vraies
 * sources (Brave Search, vérification HTTP) implémentent les mêmes interfaces (`OfferDiscoverySource`, `OfferVerifier`).
 */
import type { DiscoveryQuery, OfferDiscoverySource, OfferVerifier } from "./pipeline";
import { canonicalizeUrl, tokenize } from "./text";
import type { OfferCandidate, VerificationFailure, VerificationFailureReason, VerifiedOffer } from "./types";

export type SimulatedPage =
  | { url: string; title: string; snippet?: string; page: Omit<VerifiedOffer, "url" | "canonicalUrl" | "title" | "checkedAt"> & { checkedAt?: Date } }
  | { url: string; title: string; snippet?: string; failure: { reason: VerificationFailureReason; transient: boolean } };

const STOP = new Set(["neuf", "livraison", "gratuit", "prix", "de", "la", "le", "du", "des", "et", "en", "pour", "a", "au", "avec"]);

export interface SimulatedWeb {
  source: OfferDiscoverySource;
  verifier: OfferVerifier;
  /** Compteurs d'appels, pour contrôler les budgets. */
  calls: { discover: number; verify: number };
  verifiedUrls: string[];
}

export function createSimulatedWeb(pages: SimulatedPage[], opts: { now?: () => Date; name?: string; failDiscovery?: boolean } = {}): SimulatedWeb {
  const now = opts.now ?? (() => new Date());
  const calls = { discover: 0, verify: 0 };
  const verifiedUrls: string[] = [];
  const source: OfferDiscoverySource = {
    name: opts.name ?? "simulated",
    async discover(query: DiscoveryQuery): Promise<OfferCandidate[]> {
      calls.discover++;
      if (opts.failDiscovery) throw new Error("source simulée indisponible");
      const q = new Set(tokenize(query.text).filter((t) => !STOP.has(t)));
      // Comme un vrai moteur : résultats larges, au moins un mot en commun avec la requête.
      return pages
        .filter((p) => tokenize(`${p.title} ${p.snippet ?? ""}`).some((t) => q.has(t)))
        .slice(0, query.limit)
        .map((p) => ({ url: p.url, title: p.title, snippet: p.snippet, discoveredBy: source.name, discoveredAt: now() }));
    },
  };
  const verifier: OfferVerifier = {
    async verify(candidate) {
      calls.verify++;
      verifiedUrls.push(candidate.url);
      const key = canonicalizeUrl(candidate.url);
      const page = pages.find((p) => canonicalizeUrl(p.url) === key);
      const checkedAt = now();
      if (!page) return { ok: false, url: candidate.url, reason: "not_found", transient: false, checkedAt } satisfies VerificationFailure;
      if ("failure" in page) return { ok: false, url: candidate.url, ...page.failure, checkedAt };
      return {
        ok: true,
        offer: { ...page.page, url: page.url, canonicalUrl: key ?? page.url, title: page.title, checkedAt: page.page.checkedAt ?? checkedAt },
      };
    },
  };
  return { source, verifier, calls, verifiedUrls };
}

