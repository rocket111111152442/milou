import "server-only";
import { sql } from "@waverti/database";
import { getDb, isDatabaseConfigured } from "./db";

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterSec: number;
}

/**
 * Limitation à fenêtre fixe stockée en base (partagée entre toutes les instances serverless).
 * `bucket` ne doit contenir aucune donnée personnelle en clair (utiliser ipKey()).
 */
export async function rateLimit(bucket: string, limit: number, windowSec: number): Promise<RateLimitResult> {
  if (!isDatabaseConfigured()) return { ok: true, remaining: limit, retryAfterSec: 0 };
  const windowMs = windowSec * 1000;
  const start = Math.floor(Date.now() / windowMs) * windowMs;
  const rows = await getDb().execute<{ hits: number }>(sql`
    insert into rate_limits (bucket, window_start, hits) values (${bucket}, ${new Date(start).toISOString()}::timestamptz, 1)
    on conflict (bucket, window_start) do update set hits = rate_limits.hits + 1
    returning hits`);
  const hits = Number(rows[0]?.hits ?? 1);
  const retryAfterSec = Math.ceil((start + windowMs - Date.now()) / 1000);
  return { ok: hits <= limit, remaining: Math.max(0, limit - hits), retryAfterSec };
}
