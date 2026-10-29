/**
 * Règles robots.txt (RFC 9309) — module PUR, sans dépendance réseau : utilisé par le serveur
 * et par l'application desktop.
 */
export interface Rule {
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

