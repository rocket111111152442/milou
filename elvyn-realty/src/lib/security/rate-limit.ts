/**
 * Fixed-window in-memory rate limiter. Per server instance: on serverless platforms it limits
 * bursts per instance; the AI budget and daily caps stored in the database are the global limits.
 */
const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, limit: number, windowMs: number): { ok: boolean; retryAfterSec: number } {
  const now = Date.now();
  if (buckets.size > 10_000) for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterSec: 0 };
  }
  if (b.count >= limit) return { ok: false, retryAfterSec: Math.ceil((b.resetAt - now) / 1000) };
  b.count++;
  return { ok: true, retryAfterSec: 0 };
}

export function clientIp(headers: Headers): string {
  const fwd = headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim().slice(0, 64);
  return headers.get("x-real-ip")?.slice(0, 64) ?? "unknown";
}

/**
 * Spam heuristics for public forms: a hidden honeypot field must stay empty and the form must
 * not be submitted faster than a human could fill it.
 */
export function looksLikeSpam(body: { website?: unknown; startedAt?: unknown }): boolean {
  if (typeof body.website === "string" && body.website.trim() !== "") return true;
  const started = Number(body.startedAt);
  if (!Number.isFinite(started)) return true;
  const elapsed = Date.now() - started;
  return elapsed < 2500 || elapsed > 1000 * 60 * 60 * 24;
}

/** Same-origin check for state-changing requests from the browser. */
export function sameOrigin(headers: Headers, siteUrl: string): boolean {
  const origin = headers.get("origin");
  if (!origin) return true; // non-browser clients; other checks still apply
  const host = headers.get("x-forwarded-host") ?? headers.get("host");
  try {
    const o = new URL(origin);
    return o.host === host || o.origin === new URL(siteUrl).origin;
  } catch {
    return false;
  }
}
