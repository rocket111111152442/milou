/**
 * Respect de robots.txt (RFC 9309) pour les contrôles automatiques.
 * Groupe « watchlybot » prioritaire, sinon « * ». Règle la plus longue gagnante, Allow
 * l'emporte à longueur égale. Jokers `*` et ancre `$` pris en charge.
 * Erreur serveur / réseau : interdiction temporaire (RFC 9309 §2.3.1.4). 4xx : tout est autorisé.
 */
import { decodeBody, safeFetch, type SafeFetchOptions } from "./safe-fetch";
import { isAllowedByRules, parseRobots, type RobotsPolicy } from "./robots-rules";

export { isAllowedByRules, parseRobots, type RobotsPolicy };

export class RobotsCache {
  private cache = new Map<string, RobotsPolicy>();
  constructor(
    private readonly fetchOptions: SafeFetchOptions = {},
    private readonly maxEntries = 5000,
  ) {}

  async isAllowed(url: URL): Promise<boolean> {
    if (url.pathname === "/robots.txt") return true;
    const policy = await this.policyFor(url.origin);
    if (policy.mode === "none") return true;
    if (policy.mode === "full") return false;
    return isAllowedByRules(policy.rules, url.pathname + url.search);
  }

  async policyFor(origin: string): Promise<RobotsPolicy> {
    const cached = this.cache.get(origin);
    if (cached && Date.now() - cached.fetchedAt < cached.ttlMs) return cached;
    let policy: RobotsPolicy;
    try {
      const res = await safeFetch(`${origin}/robots.txt`, {
        ...this.fetchOptions,
        timeoutMs: 6000,
        maxBytes: 500 * 1024,
        accept: "text/plain,*/*;q=0.1",
      });
      if (res.status >= 200 && res.status < 300) {
        policy = { mode: "rules", rules: parseRobots(decodeBody(res.body, res.contentType)), fetchedAt: Date.now(), ttlMs: 24 * 3_600_000 };
      } else if (res.status >= 400 && res.status < 500) {
        policy = { mode: "none", rules: [], fetchedAt: Date.now(), ttlMs: 24 * 3_600_000 };
      } else {
        policy = { mode: "full", rules: [], fetchedAt: Date.now(), ttlMs: 3_600_000 };
      }
    } catch {
      policy = { mode: "full", rules: [], fetchedAt: Date.now(), ttlMs: 3_600_000 };
    }
    if (this.cache.size >= this.maxEntries) this.cache.delete(this.cache.keys().next().value!);
    this.cache.set(origin, policy);
    return policy;
  }
}
