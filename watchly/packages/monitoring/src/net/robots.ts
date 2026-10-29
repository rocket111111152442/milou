/**
 * Respect de robots.txt (RFC 9309) pour les contrôles automatiques.
 * Groupe « watchlybot » prioritaire, sinon « * ». Règle la plus longue gagnante, Allow
 * l'emporte à longueur égale. Jokers `*` et ancre `$` pris en charge.
 * Erreur serveur / réseau : interdiction temporaire (RFC 9309 §2.3.1.4). 4xx : tout est autorisé.
 */
import { decodeBody, safeFetch, type SafeFetchOptions } from "./safe-fetch";

interface Rule {
  allow: boolean;
  pattern: string;
}

export interface RobotsPolicy {
  rules: Rule[];
  /** "full" = tout interdit (erreur serveur), "none" = aucune restriction. */
  mode: "rules" | "full" | "none";
  fetchedAt: number;
  ttlMs: number;
}

export function parseRobots(text: string, agent = "watchlybot"): Rule[] {
  const groups: Array<{ agents: string[]; rules: Rule[] }> = [];
  let current: { agents: string[]; rules: Rule[] } | null = null;
  let lastWasAgent = false;
  for (const rawLine of text.split(/\r?\n/).slice(0, 5000)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (!line) continue;
    const idx = line.indexOf(":");
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();
    if (key === "user-agent") {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
    } else if ((key === "allow" || key === "disallow") && current) {
      lastWasAgent = false;
      if (key === "disallow" && value === "") continue;
      current.rules.push({ allow: key === "allow", pattern: value });
    } else {
      lastWasAgent = false;
    }
  }
  const specific = groups.filter((g) => g.agents.some((a) => a !== "*" && agent.startsWith(a)));
  const chosen = specific.length ? specific : groups.filter((g) => g.agents.includes("*"));
  return chosen.flatMap((g) => g.rules);
}

function patternToRegex(pattern: string): RegExp {
  const anchored = pattern.endsWith("$");
  const body = (anchored ? pattern.slice(0, -1) : pattern)
    .split("*")
    .map((s) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${body}${anchored ? "$" : ""}`);
}

export function isAllowedByRules(rules: Rule[], pathWithQuery: string): boolean {
  let best: Rule | null = null;
  for (const r of rules) {
    if (!patternToRegex(r.pattern).test(pathWithQuery)) continue;
    if (!best || r.pattern.length > best.pattern.length || (r.pattern.length === best.pattern.length && r.allow)) best = r;
  }
  return best ? best.allow : true;
}

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
