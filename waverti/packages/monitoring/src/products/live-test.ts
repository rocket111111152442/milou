/**
 * Test réel Brave, strictement encadré : UNE seule requête, budget plafonné, aucune persistance, aucun retry.
 *
 * Ce module ne fait rien tout seul : il faut l'appeler explicitement ET que l'environnement porte l'autorisation écrite
 * `WAVERTI_LIVE_BRAVE_TEST=AUTHORIZED_ONE_REQUEST` (posée par le propriétaire, jamais par défaut, jamais en CI).
 * Aucun accès base de données : ni cache, ni compteur d'abonnement, ni écriture. Aucun impact sur la Production.
 */
import { createBraveProvider, SearchProviderError, type SearchResultItem } from "../search/brave";
import { buildProductQueries } from "./discovery/query";
import { prefilterResults } from "./discovery/filter";
import type { ProductTarget } from "./types";

export const LIVE_TEST_AUTHORIZATION = "AUTHORIZED_ONE_REQUEST";
/** Budget maximal du test, en millionièmes de dollar ($0.005). */
export const LIVE_TEST_BUDGET_MICROS = 5000;
export const LIVE_TEST_MAX_REQUESTS = 1;

export class LiveTestRefused extends Error {
  constructor(
    readonly code: "not_authorized" | "no_api_key" | "budget_exceeded" | "second_request_blocked" | "no_query",
    message: string,
  ) {
    super(message);
    this.name = "LiveTestRefused";
  }
}

export interface LiveTestEnv {
  WAVERTI_LIVE_BRAVE_TEST?: string;
  BRAVE_SEARCH_API_KEY?: string;
  /** Coût unitaire supposé d'une requête, en millionièmes de dollar (défaut : 5000 = $0.005). */
  WAVERTI_BRAVE_REQUEST_COST_MICROS?: string;
}

/** Vérifie toutes les conditions AVANT tout appel réseau. */
export function assertLiveTestAllowed(env: LiveTestEnv): { apiKey: string; costMicros: number } {
  if (env.WAVERTI_LIVE_BRAVE_TEST !== LIVE_TEST_AUTHORIZATION) throw new LiveTestRefused("not_authorized", "autorisation explicite absente : aucun appel émis");
  const apiKey = env.BRAVE_SEARCH_API_KEY?.trim();
  if (!apiKey) throw new LiveTestRefused("no_api_key", "clé Brave absente : aucun appel émis");
  const raw = env.WAVERTI_BRAVE_REQUEST_COST_MICROS;
  const costMicros = raw === undefined ? 5000 : Number(raw);
  if (!Number.isFinite(costMicros) || costMicros < 0) throw new LiveTestRefused("budget_exceeded", "coût unitaire invalide : aucun appel émis");
  if (costMicros * LIVE_TEST_MAX_REQUESTS > LIVE_TEST_BUDGET_MICROS) throw new LiveTestRefused("budget_exceeded", "le coût dépasse le budget de $0.005 : aucun appel émis");
  return { apiKey, costMicros };
}

/** Enveloppe de `fetch` : la deuxième requête est refusée avant d'atteindre le réseau. */
export function singleShotFetch(real: typeof fetch): { fetch: typeof fetch; readonly calls: number } {
  let calls = 0;
  return {
    get calls() {
      return calls;
    },
    fetch: ((input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
      if (calls >= LIVE_TEST_MAX_REQUESTS) throw new LiveTestRefused("second_request_blocked", "une seule requête Brave est permise");
      calls++;
      return real(input, init);
    }) as typeof fetch,
  };
}

export interface LiveProbeReport {
  braveRequests: number;
  estimatedCostMicros: number;
  query: string;
  outcome: "success" | "failure";
  failure?: { retryable: boolean; status: number | null };
  rawResults: number;
  kept: number;
  dropped: Record<string, number>;
  /** Adresses retenues, en mémoire seulement (affichage ponctuel) : jamais écrites en base ni en fichier. */
  candidates: { url: string; hostname: string; title: string }[];
}

export async function runSingleBraveProbe(opts: { env: LiveTestEnv; target: ProductTarget; fetchImpl?: typeof fetch; now?: Date }): Promise<LiveProbeReport> {
  const { apiKey, costMicros } = assertLiveTestAllowed(opts.env);
  const query = buildProductQueries(opts.target, { maxQueries: 1 })[0];
  if (!query) throw new LiveTestRefused("no_query", "aucune requête précise constructible pour ce produit : aucun appel émis");
  const guarded = singleShotFetch(opts.fetchImpl ?? fetch);
  const provider = createBraveProvider(apiKey, undefined, guarded.fetch);
  let items: SearchResultItem[] = [];
  let failure: LiveProbeReport["failure"];
  try {
    items = await provider.search(query, { count: 10 }); // une seule tentative, jamais rejouée
  } catch (e) {
    if (e instanceof LiveTestRefused) throw e;
    failure = e instanceof SearchProviderError ? { retryable: e.retryable, status: e.status ?? null } : { retryable: false, status: null };
  }
  const out = prefilterResults(opts.target, items, { now: opts.now ?? new Date(), discoveredBy: "brave" });
  const dropped: Record<string, number> = {};
  for (const d of out.dropped) dropped[d.reason] = (dropped[d.reason] ?? 0) + 1;
  return {
    braveRequests: guarded.calls,
    estimatedCostMicros: guarded.calls * costMicros,
    query,
    outcome: failure ? "failure" : "success",
    failure,
    rawResults: items.length,
    kept: out.kept.length,
    dropped,
    candidates: out.kept.map((k) => ({ url: k.candidate.url, hostname: new URL(k.candidate.url).hostname, title: k.candidate.title ?? "" })),
  };
}
