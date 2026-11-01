/**
 * Client Brave Search API (serveur uniquement : la clé n'est jamais transmise au navigateur ni au desktop).
 * Doc : https://api-dashboard.search.brave.com/app/documentation/web-search
 */
export interface SearchResultItem {
  url: string;
  title: string;
  description: string;
  age: string | null;
  publishedAt: string | null;
  hostname: string;
}

/** Informations techniques de la réponse (compteur des appels, quota annoncé par le fournisseur). */
export interface SearchResponseMeta {
  status: number;
  quotaRemaining: number | null;
  quotaLimit: number | null;
}

export interface SearchOptions {
  count?: number;
  freshness?: "pd" | "pw" | "pm" | "py";
  onResponse?: (meta: SearchResponseMeta) => void;
}

export interface SearchProvider {
  readonly name: string;
  search(query: string, opts?: SearchOptions): Promise<SearchResultItem[]>;
}

/** « 1, 15000 » (par seconde, par mois) : la dernière valeur est le quota mensuel. */
export function lastRateLimitValue(header: string | null): number | null {
  if (!header) return null;
  const parts = header.split(",").map((s) => Number(s.trim()));
  const v = parts[parts.length - 1];
  return v !== undefined && Number.isFinite(v) ? v : null;
}

export class SearchProviderError extends Error {
  constructor(
    message: string,
    public readonly retryable: boolean,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "SearchProviderError";
  }
}

const stripTags = (s: string) => s.replace(/<[^>]+>/g, "").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");

const MAX_RESPONSE_CHARS = 2_000_000;

function safeHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

export function createBraveProvider(apiKey: string, base = "https://api.search.brave.com", fetchImpl: typeof fetch = fetch, timeoutMs = 15_000): SearchProvider {
  return {
    name: "brave",
    async search(query, opts = {}) {
      const u = new URL(`${base.replace(/\/$/, "")}/res/v1/web/search`);
      u.searchParams.set("q", query.slice(0, 400));
      u.searchParams.set("count", String(Math.min(20, opts.count ?? 10)));
      u.searchParams.set("country", "FR");
      u.searchParams.set("search_lang", "fr");
      u.searchParams.set("safesearch", "moderate");
      if (opts.freshness) u.searchParams.set("freshness", opts.freshness);
      const res = await fetchImpl(u, {
        headers: { accept: "application/json", "x-subscription-token": apiKey },
        signal: AbortSignal.timeout(timeoutMs),
      });
      opts.onResponse?.({
        status: res.status,
        quotaRemaining: lastRateLimitValue(res.headers.get("x-ratelimit-remaining")),
        quotaLimit: lastRateLimitValue(res.headers.get("x-ratelimit-limit")),
      });
      if (!res.ok) throw new SearchProviderError(`Brave HTTP ${res.status}`, res.status === 429 || res.status >= 500, res.status);
      // Réponse mal formée (JSON invalide, trop volumineuse, forme inattendue) : échec non réessayable, jamais d'exception brute.
      const text = await res.text();
      if (text.length > MAX_RESPONSE_CHARS) throw new SearchProviderError("Brave : réponse trop volumineuse", false, res.status);
      let body: { web?: { results?: Array<{ url?: string; title?: string; description?: string; age?: string; page_age?: string; meta_url?: { hostname?: string } }> } };
      try {
        body = JSON.parse(text);
      } catch {
        throw new SearchProviderError("Brave : réponse illisible (JSON invalide)", false, res.status);
      }
      if (!body || typeof body !== "object" || Array.isArray(body) || (body.web !== undefined && (typeof body.web !== "object" || body.web === null)) || (body.web?.results !== undefined && !Array.isArray(body.web.results))) {
        throw new SearchProviderError("Brave : forme de réponse inattendue", false, res.status);
      }
      return (body.web?.results ?? [])
        .filter((r) => r && typeof r.url === "string" && r.url.length <= 2048 && /^https?:\/\//.test(r.url))
        .map((r) => ({
          url: r.url!,
          title: stripTags(r.title ?? "").slice(0, 300),
          description: stripTags(r.description ?? "").slice(0, 1000),
          age: r.age ?? null,
          publishedAt: r.page_age ?? null,
          hostname: (typeof r.meta_url?.hostname === "string" ? r.meta_url.hostname : safeHostname(r.url!)).toLowerCase().replace(/^www\./, ""),
        }))
        .filter((r) => r.hostname.length > 0);
    },
  };
}
