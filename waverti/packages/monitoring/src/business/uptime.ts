/**
 * Surveillance de disponibilité (contrôles HTTP à la minute), exécutée UNIQUEMENT par les serveurs.
 *
 * Machine d'états d'un point de contrôle :
 * - échec isolé : nouvel essai de confirmation 20 s plus tard, sans alerte ;
 * - 2 échecs consécutifs : incident ouvert + alerte (une seule fois) ;
 * - 2 succès consécutifs après un incident : incident clos + alerte de rétablissement.
 */
import { businessChecks, sql, type Database } from "@waverti/database";
import type { SafeFetchOptions } from "../net/safe-fetch";
import { checkEndpoint, type HttpCheckResult } from "./http-check";
import { openIncident, resolveIncident } from "./incidents";

export const CONFIRM_FAILURES = 2;
export const RECOVERY_SUCCESSES = 2;
export const CONFIRMATION_DELAY_MS = 20_000;

export interface ClaimedEndpoint {
  id: string;
  siteId: string;
  userId: string;
  siteName: string;
  domain: string;
  name: string;
  url: string;
  method: "GET" | "HEAD";
  expectedStatusMin: number;
  expectedStatusMax: number;
  expectedKeyword: string | null;
  timeoutMs: number;
  slowThresholdMs: number;
  intervalSeconds: number;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  state: "unknown" | "up" | "down" | "degraded";
}

/**
 * Réserve les points de contrôle arrivés à échéance (bail exclusif, sans doublon entre workers).
 * Seuls les sites vérifiés d'utilisateurs dont la formule inclut Business sont contrôlés.
 */
export async function claimDueEndpoints(
  db: Database,
  opts: { workerId: string; max: number; leaseSeconds?: number; now?: Date },
): Promise<ClaimedEndpoint[]> {
  const now = opts.now ?? new Date();
  const lease = new Date(now.getTime() + (opts.leaseSeconds ?? 60) * 1000);
  const rows = await db.execute<Record<string, unknown>>(sql`
    with due as (
      select e.id
      from business_endpoints e
      join business_sites s on s.id = e.site_id and s.status = 'verified'
      join entitlements en on en.user_id = e.user_id and en.business_sites > 0
      join profiles p on p.id = e.user_id and p.suspended_at is null
      where e.enabled and e.next_check_at <= ${now.toISOString()}::timestamptz
        and (e.lease_expires_at is null or e.lease_expires_at < ${now.toISOString()}::timestamptz)
      order by e.next_check_at
      limit ${opts.max}
      for update of e skip locked
    )
    update business_endpoints e set lease_expires_at = ${lease.toISOString()}::timestamptz, lease_owner = ${opts.workerId}
    from due, business_sites s
    where e.id = due.id and s.id = e.site_id
    returning e.id, e.site_id, e.user_id, s.name as site_name, s.domain, e.name, e.url, e.method,
      e.expected_status_min, e.expected_status_max, e.expected_keyword, e.timeout_ms, e.slow_threshold_ms,
      e.interval_seconds, e.consecutive_failures, e.consecutive_successes, e.state`);
  return rows.map((r) => ({
    id: r.id as string,
    siteId: r.site_id as string,
    userId: r.user_id as string,
    siteName: r.site_name as string,
    domain: r.domain as string,
    name: r.name as string,
    url: r.url as string,
    method: r.method as "GET" | "HEAD",
    expectedStatusMin: r.expected_status_min as number,
    expectedStatusMax: r.expected_status_max as number,
    expectedKeyword: (r.expected_keyword as string | null) ?? null,
    timeoutMs: r.timeout_ms as number,
    slowThresholdMs: r.slow_threshold_ms as number,
    intervalSeconds: r.interval_seconds as number,
    consecutiveFailures: r.consecutive_failures as number,
    consecutiveSuccesses: r.consecutive_successes as number,
    state: r.state as ClaimedEndpoint["state"],
  }));
}

/** Enregistre le résultat, fait évoluer l'état et ouvre / clôt les incidents. */
export async function recordEndpointResult(
  db: Database,
  ep: ClaimedEndpoint,
  workerId: string,
  result: HttpCheckResult,
  now = new Date(),
): Promise<{ state: ClaimedEndpoint["state"]; incidentOpened: string | null; incidentResolved: string | null }> {
  return db.transaction(async (tx) => {
    const failures = result.ok ? 0 : ep.consecutiveFailures + 1;
    const successes = result.ok ? ep.consecutiveSuccesses + 1 : 0;
    // Seul le contrôle rapproché qui suit un premier échec est un échantillon supplémentaire ;
    // les échecs suivants comptent normalement dans la disponibilité.
    const isConfirmation = ep.consecutiveFailures === 1;
    const confirmedDown = !result.ok && failures >= CONFIRM_FAILURES;
    let state: ClaimedEndpoint["state"];
    if (result.ok) state = ep.state === "down" && successes < RECOVERY_SUCCESSES ? "down" : result.slow ? "degraded" : "up";
    else state = confirmedDown ? "down" : ep.state;

    // Échec isolé : contrôle de confirmation rapproché ; sinon cadence normale.
    const nextAt = !result.ok && failures < CONFIRM_FAILURES ? new Date(now.getTime() + CONFIRMATION_DELAY_MS) : new Date(now.getTime() + ep.intervalSeconds * 1000);

    const updated = await tx.execute<{ id: string }>(sql`
      update business_endpoints set
        state = ${state}, consecutive_failures = ${failures}, consecutive_successes = ${successes},
        last_checked_at = ${now.toISOString()}::timestamptz, last_response_ms = ${result.responseMs},
        last_status_code = ${result.statusCode}, last_error = ${result.error},
        next_check_at = ${nextAt.toISOString()}::timestamptz, lease_expires_at = null, lease_owner = null
      where id = ${ep.id} and lease_owner = ${workerId}
      returning id`);
    if (!updated.length) return { state: ep.state, incidentOpened: null, incidentResolved: null }; // bail perdu : résultat ignoré

    await tx.insert(businessChecks).values({
      endpointId: ep.id,
      siteId: ep.siteId,
      userId: ep.userId,
      checkedAt: now,
      ok: result.ok,
      statusCode: result.statusCode,
      responseMs: result.responseMs,
      errorCode: result.errorCode,
      isConfirmation,
    });

    let incidentOpened: string | null = null;
    let incidentResolved: string | null = null;
    if (confirmedDown) {
      const startedAt = new Date(now.getTime() - (failures - 1) * CONFIRMATION_DELAY_MS);
      incidentOpened = await openIncident(tx, {
        userId: ep.userId,
        siteId: ep.siteId,
        siteName: ep.siteName,
        kind: "downtime",
        endpointId: ep.id,
        title: `${ep.name} ne répond plus correctement`,
        cause: result.error ?? "Échec du contrôle.",
        startedAt,
        lastError: result.error,
        failedChecks: failures,
        now,
      });
      if (!incidentOpened) {
        await tx.execute(sql`
          update incidents set failed_checks = failed_checks + 1, last_error = ${result.error}
          where endpoint_id = ${ep.id} and kind = 'downtime' and status = 'open'`);
      }
    } else if (result.ok && successes >= RECOVERY_SUCCESSES) {
      incidentResolved = await resolveIncident(tx, { userId: ep.userId, siteName: ep.siteName, endpointId: ep.id }, `${ep.name} répond de nouveau normalement.`, now);
    }
    return { state, incidentOpened, incidentResolved };
  });
}

/** Une passe complète : réservation, contrôles en parallèle borné, enregistrement. */
export async function runUptimePass(
  db: Database,
  opts: { workerId: string; max: number; concurrency: number; fetchOptions?: SafeFetchOptions; now?: () => Date },
): Promise<number> {
  const claimed = await claimDueEndpoints(db, { workerId: opts.workerId, max: opts.max });
  let i = 0;
  const workers = Array.from({ length: Math.min(opts.concurrency, claimed.length) }, async () => {
    while (i < claimed.length) {
      const ep = claimed[i++]!;
      const result = await checkEndpoint(ep, opts.fetchOptions);
      await recordEndpointResult(db, ep, opts.workerId, result, opts.now?.() ?? new Date());
    }
  });
  await Promise.all(workers);
  return claimed.length;
}

