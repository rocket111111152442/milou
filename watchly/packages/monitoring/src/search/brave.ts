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

export interface SearchProvider {
  readonly name: string;
  search(query: string, opts?: { count?: number; freshness?: "pd" | "pw" | "pm" | "py" }): Promise<SearchResultItem[]>;
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

export function createBraveProvider(apiKey: string, base = "https://api.search.brave.com", fetchImpl: typeof fetch = fetch): SearchProvider {
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
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) throw new SearchProviderError(`Brave HTTP ${res.status}`, res.status === 429 || res.status >= 500, res.status);
      const body = (await res.json()) as {
        web?: { results?: Array<{ url?: string; title?: string; description?: string; age?: string; page_age?: string; meta_url?: { hostname?: string } }> };
      };
      return (body.web?.results ?? [])
        .filter((r) => typeof r.url === "string" && /^https?:\/\//.test(r.url))
        .map((r) => ({
          url: r.url!,
          title: stripTags(r.title ?? "").slice(0, 300),
          description: stripTags(r.description ?? "").slice(0, 1000),
          age: r.age ?? null,
          publishedAt: r.page_age ?? null,
          hostname: (r.meta_url?.hostname ?? new URL(r.url!).hostname).toLowerCase().replace(/^www\./, ""),
        }));
    },
  };
}
