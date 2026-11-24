import "server-only";
import { env } from "@/config/env";
import { log } from "@/lib/log";

export class AlterEstateError extends Error {
  constructor(message: string, readonly status: number | null, readonly retryable: boolean) {
    super(message);
    this.name = "AlterEstateError";
  }
}
export class AlterEstateNotFound extends AlterEstateError {
  constructor() {
    super("not_found", 404, false);
    this.name = "AlterEstateNotFound";
  }
}

/**
 * Process-wide pacing: AlterEstate allows 10 req/s per account (docs, "Rate limits").
 * We stay below with a minimum interval between request starts. On serverless each
 * instance paces itself; the response cache keeps the real volume far below the limit.
 */
const MIN_INTERVAL_MS = 125; // <= 8 requests/second per instance
let nextSlot = 0;
async function pace() {
  const now = Date.now();
  const wait = Math.max(0, nextSlot - now);
  nextSlot = Math.max(now, nextSlot) + MIN_INTERVAL_MS;
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function retryAfterMs(res: Response, attempt: number): number {
  const ra = res.headers.get("retry-after");
  if (ra) {
    const secs = Number(ra);
    if (Number.isFinite(secs)) return Math.min(secs * 1000, 10_000);
    const date = Date.parse(ra);
    if (Number.isFinite(date)) return Math.min(Math.max(date - Date.now(), 0), 10_000);
  }
  return Math.min(500 * 2 ** attempt, 4000) + Math.floor(Math.random() * 250);
}

type Query = Record<string, string | number | boolean | Array<string | number> | null | undefined>;

export function buildUrl(path: string, query: Query = {}): string {
  const url = new URL(env.alterestate.baseUrl + path);
  for (const [k, v] of Object.entries(query)) {
    if (v === null || v === undefined || v === "") continue;
    if (Array.isArray(v)) v.forEach((x) => url.searchParams.append(k, String(x)));
    else url.searchParams.set(k, String(v));
  }
  return url.toString();
}

/**
 * GET a public AlterEstate endpoint with the `aetoken` header.
 * Retries 429 / 5xx / network errors with backoff (honours Retry-After). Never logs the token.
 */
export async function aeGet(path: string, query: Query = {}, opts: { attempts?: number; timeoutMs?: number } = {}): Promise<unknown> {
  const token = env.alterestate.publicToken;
  if (!token) throw new AlterEstateError("missing_public_token", null, false);
  const attempts = opts.attempts ?? 3;
  const url = buildUrl(path, query);
  let lastErr: AlterEstateError | null = null;

  for (let attempt = 0; attempt < attempts; attempt++) {
    await pace();
    let res: Response;
    try {
      res = await fetch(url, {
        headers: { aetoken: token, Accept: "application/json" },
        cache: "no-store",
        signal: AbortSignal.timeout(opts.timeoutMs ?? 10_000),
      });
    } catch {
      lastErr = new AlterEstateError("network_error", null, true);
      log.warn("alterestate.network_error", { path, attempt });
      await sleep(Math.min(500 * 2 ** attempt, 4000));
      continue;
    }

    if (res.ok) {
      let text: string;
      try {
        text = await res.text();
      } catch {
        // The timeout also covers reading the body: retry like a network error.
        lastErr = new AlterEstateError("network_error", null, true);
        log.warn("alterestate.body_timeout", { path, attempt });
        await sleep(Math.min(500 * 2 ** attempt, 4000));
        continue;
      }
      if (!text) throw new AlterEstateNotFound();
      try {
        return JSON.parse(text);
      } catch {
        throw new AlterEstateError("invalid_json", res.status, false);
      }
    }

    if (res.status === 404) {
      // Missing/invalid token and missing listing both return 404 (docs). Distinguish by body.
      const body = await res.text().catch(() => "");
      if (body.includes('"error"') && body.includes("Not found")) {
        log.error("alterestate.invalid_token_or_route", { path });
        throw new AlterEstateError("invalid_token", 404, false);
      }
      throw new AlterEstateNotFound();
    }
    if (res.status === 429 || res.status >= 500) {
      lastErr = new AlterEstateError(`http_${res.status}`, res.status, true);
      log.warn("alterestate.retry", { path, status: res.status, attempt });
      await sleep(retryAfterMs(res, attempt));
      continue;
    }
    throw new AlterEstateError(`http_${res.status}`, res.status, false);
  }
  throw lastErr ?? new AlterEstateError("unknown", null, true);
}
