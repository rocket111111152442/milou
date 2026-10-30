/**
 * File de tâches hybride (PostgreSQL, source de vérité unique).
 *
 *  - Planification : une ligne monitoring_jobs par créneau ; contrainte unique (task_id, slot_at)
 *    et index unique partiel « une seule exécution vivante par surveillance » => jamais deux
 *    exécutions simultanées du même contrôle, même si plusieurs planificateurs tournent.
 *  - Réservation atomique : UPDATE ... WHERE id IN (SELECT ... FOR UPDATE SKIP LOCKED).
 *    Chaque réservation reçoit un claim_token ; seul le détenteur du jeton peut rendre un résultat.
 *  - Baux : une réservation non terminée à l'échéance du bail est remise en file (tentatives
 *    limitées) => reprise après panne d'un worker ou fermeture brutale de l'application.
 *  - Hybride : préférence « agent » (PC de l'utilisateur) avec délai de grâce ; au-delà, les
 *    serveurs reprennent la tâche si la formule inclut le relais cloud. Sinon (Découverte),
 *    le contrôle est simplement suspendu.
 */
import {
  and,
  agentDevices,
  entitlements,
  eq,
  gt,
  isNotNull,
  sql,
  tsParam,
  type Database,
  type Executor,
} from "@watchly/database";
import { computeNextRun } from "./schedule/next-run";

export const AGENT_ONLINE_WINDOW_MS = 3 * 60_000;
export const DEFAULT_AGENT_GRACE_SECONDS = 600;
export const DEFAULT_LEASE_SECONDS = 300;

export interface ScheduleOptions {
  now?: Date;
  limit?: number;
  agentGraceSeconds?: number;
}

export interface ScheduledJob {
  jobId: string;
  taskId: string;
  preferredExecutor: "agent" | "cloud";
  allowCloud: boolean;
  allowAgent: boolean;
}

interface DueRow extends Record<string, unknown> {
  task_id: string;
  user_id: string;
  interval_minutes: number;
  next_run_at: Date;
  kind: "page" | "web_topic";
  execution_mode: "auto" | "local_only" | "cloud_only";
}

/** Utilisateurs ayant au moins un appareil actif, consentant et vu récemment. */
async function onlineAgentUsers(db: Executor, userIds: string[], now: Date): Promise<Set<string>> {
  if (!userIds.length) return new Set();
  const rows = await db
    .select({ userId: agentDevices.userId })
    .from(agentDevices)
    .where(
      and(
        sql`${agentDevices.userId} in ${userIds}`,
        eq(agentDevices.status, "active"),
        eq(agentDevices.monitoringEnabled, true),
        isNotNull(agentDevices.consentLocalAt),
        gt(agentDevices.lastSeenAt, new Date(now.getTime() - AGENT_ONLINE_WINDOW_MS)),
        // Un ordinateur mis en pause par son utilisateur n'est pas disponible pour les contrôles.
        sql`${agentDevices.lastState} is distinct from 'paused'`,
      ),
    );
  return new Set(rows.map((r) => r.userId));
}

export function decideExecutor(input: {
  kind: "page" | "web_topic";
  executionMode: "auto" | "local_only" | "cloud_only";
  cloudRelay: boolean;
  agentOnline: boolean;
}): { preferred: "agent" | "cloud"; allowAgent: boolean; allowCloud: boolean } {
  // Les recherches Web utilisent des API payantes dont les clés restent sur le serveur.
  if (input.kind === "web_topic") return { preferred: "cloud", allowAgent: false, allowCloud: true };
  if (!input.cloudRelay || input.executionMode === "local_only") return { preferred: "agent", allowAgent: true, allowCloud: false };
  if (input.executionMode === "cloud_only") return { preferred: "cloud", allowAgent: false, allowCloud: true };
  return input.agentOnline
    ? { preferred: "agent", allowAgent: true, allowCloud: true }
    : { preferred: "cloud", allowAgent: true, allowCloud: true };
}

/** Crée les tâches arrivées à échéance et avance leur prochaine exécution. Idempotent. */
export async function scheduleDueTasks(db: Database, opts: ScheduleOptions = {}): Promise<ScheduledJob[]> {
  const now = opts.now ?? new Date();
  const grace = opts.agentGraceSeconds ?? DEFAULT_AGENT_GRACE_SECONDS;
  return db.transaction(async (tx) => {
    const due = await tx.execute<DueRow>(sql`
      select s.task_id, s.user_id, s.interval_minutes, s.next_run_at, t.kind, t.execution_mode
      from monitoring_schedules s
      join monitoring_tasks t on t.id = s.task_id
      join profiles p on p.id = s.user_id
      -- Sans abonnement ni essai valide, rien n'est planifié (la tâche reprendra dès le retour des droits).
      join entitlements en on en.user_id = s.user_id and en.plan_id is not null
        and (en.valid_until is null or en.valid_until > ${tsParam(now)})
      where s.next_run_at <= ${tsParam(now)} and t.status in ('active', 'error') and p.suspended_at is null
      order by s.next_run_at
      limit ${opts.limit ?? 500}
      for update of s skip locked`);
    if (!due.length) return [];
    const userIds = [...new Set(due.map((d) => d.user_id))];
    const online = await onlineAgentUsers(tx, userIds, now);
    const ents = await tx
      .select({ userId: entitlements.userId, cloudRelay: entitlements.cloudRelay })
      .from(entitlements)
      .where(sql`${entitlements.userId} in ${userIds}`);
    const relay = new Map(ents.map((e) => [e.userId, e.cloudRelay]));

    const created: ScheduledJob[] = [];
    for (const d of due) {
      const decision = decideExecutor({
        kind: d.kind,
        executionMode: d.execution_mode,
        cloudRelay: relay.get(d.user_id) ?? false,
        agentOnline: online.has(d.user_id),
      });
      const slot = new Date(d.next_run_at);
      // Agent seul (Découverte / local_only) : le PC a jusqu'au créneau suivant pour exécuter le contrôle.
      const deadline = decision.allowCloud
        ? new Date(slot.getTime() + grace * 1000)
        : new Date(slot.getTime() + d.interval_minutes * 60_000);
      const inserted = await tx.execute<{ id: string }>(sql`
        insert into monitoring_jobs (task_id, user_id, kind, slot_at, preferred_executor, allow_cloud, allow_agent, agent_deadline_at, priority)
        values (${d.task_id}, ${d.user_id}, ${d.kind}, ${tsParam(slot)}, ${decision.preferred}, ${decision.allowCloud}, ${decision.allowAgent},
                ${decision.preferred === "agent" ? tsParam(deadline) : null}, 100)
        on conflict do nothing
        returning id`);
      // Le décalage de lissage est appliqué une seule fois à la création (cf. service) : ici on ajoute
      // simplement l'intervalle au créneau précédent, sans dérive.
      const next = computeNextRun({ from: now, previousNextRun: slot, intervalMinutes: d.interval_minutes, now });
      await tx.execute(sql`
        update monitoring_schedules set next_run_at = ${tsParam(next)}, last_scheduled_at = ${tsParam(now)}
        where task_id = ${d.task_id}`);
      if (inserted[0]) {
        created.push({
          jobId: inserted[0].id,
          taskId: d.task_id,
          preferredExecutor: decision.preferred,
          allowCloud: decision.allowCloud,
          allowAgent: decision.allowAgent,
        });
      }
    }
    return created;
  });
}

/**
 * Maintenance de la file : baux expirés remis en file (ou échec après max_attempts) et
 * contrôles locaux non exécutés à temps marqués « suspendus » (formule sans relais cloud).
 */
export async function recoverJobs(db: Database, now: Date = new Date()): Promise<{ requeued: number; failed: number; skipped: number }> {
  return db.transaction(async (tx) => {
    const requeued = await tx.execute(sql`
      update monitoring_jobs set status = 'pending', claimed_by = null, claimed_device_id = null, claim_token = null,
             lease_expires_at = null, worker_id = null, last_error = 'lease_expired'
      where status = 'claimed' and lease_expires_at < ${tsParam(now)} and attempts < max_attempts
      returning id`);
    const failed = await tx.execute(sql`
      update monitoring_jobs set status = 'failed', finished_at = ${tsParam(now)}, claim_token = null, lease_expires_at = null,
             last_error = 'lease_expired_max_attempts'
      where status = 'claimed' and lease_expires_at < ${tsParam(now)} and attempts >= max_attempts
      returning id`);
    const skipped = await tx.execute<{ task_id: string }>(sql`
      update monitoring_jobs set status = 'skipped', finished_at = ${tsParam(now)}, last_error = 'agent_unavailable'
      where status = 'pending' and not allow_cloud and agent_deadline_at < ${tsParam(now)}
      returning task_id`);
    if (skipped.length) {
      await tx.execute(sql`
        update monitoring_tasks set last_status = 'skipped', updated_at = ${tsParam(now)}
        where id in ${skipped.map((s) => s.task_id)} and last_status <> 'error'`);
    }
    return { requeued: requeued.length, failed: failed.length, skipped: skipped.length };
  });
}

export interface ClaimedJob {
  jobId: string;
  claimToken: string;
  leaseExpiresAt: Date;
  taskId: string;
  userId: string;
  kind: "page" | "web_topic";
  attempts: number;
}

/** Réservation par l'application desktop : uniquement les contrôles de SON utilisateur. */
export async function claimAgentJobs(
  db: Database,
  params: { userId: string; deviceId: string; max: number; leaseSeconds?: number; now?: Date },
): Promise<ClaimedJob[]> {
  const now = params.now ?? new Date();
  const lease = new Date(now.getTime() + (params.leaseSeconds ?? DEFAULT_LEASE_SECONDS) * 1000);
  const rows = await db.execute<{ id: string; claim_token: string; lease_expires_at: Date; task_id: string; user_id: string; kind: "page"; attempts: number }>(sql`
    update monitoring_jobs set status = 'claimed', claimed_by = 'agent', claimed_device_id = ${params.deviceId},
           claim_token = gen_random_uuid(), lease_expires_at = ${tsParam(lease)}, attempts = attempts + 1, claimed_at = ${tsParam(now)}
    where id in (
      select j.id from monitoring_jobs j
      join monitoring_tasks t on t.id = j.task_id
      -- Abonnement ou essai valide exigé au moment de la réservation (pas seulement à la planification).
      join entitlements en on en.user_id = j.user_id and en.plan_id is not null
        and (en.valid_until is null or en.valid_until > ${tsParam(now)})
      where j.user_id = ${params.userId} and j.status = 'pending' and j.allow_agent and j.kind = 'page'
        and j.slot_at <= ${tsParam(now)} and t.status in ('active', 'error')
      order by j.priority, j.slot_at
      limit ${Math.min(3, Math.max(1, params.max))}
      for update of j skip locked
    )
    returning id, claim_token, lease_expires_at, task_id, user_id, kind, attempts`);
  return rows.map((r) => ({
    jobId: r.id,
    claimToken: r.claim_token,
    leaseExpiresAt: new Date(r.lease_expires_at),
    taskId: r.task_id,
    userId: r.user_id,
    kind: r.kind,
    attempts: r.attempts,
  }));
}

/** Réservation par un worker serveur : tâches cloud, ou tâches agent dont le délai de grâce est dépassé. */
export async function claimCloudJobs(
  db: Database,
  params: { workerId: string; max: number; kinds?: Array<"page" | "web_topic">; leaseSeconds?: number; now?: Date },
): Promise<ClaimedJob[]> {
  const now = params.now ?? new Date();
  const lease = new Date(now.getTime() + (params.leaseSeconds ?? DEFAULT_LEASE_SECONDS) * 1000);
  const kinds = params.kinds ?? ["page", "web_topic"];
  const rows = await db.execute<{ id: string; claim_token: string; lease_expires_at: Date; task_id: string; user_id: string; kind: "page" | "web_topic"; attempts: number }>(sql`
    update monitoring_jobs set status = 'claimed', claimed_by = 'cloud', claimed_device_id = null, worker_id = ${params.workerId},
           claim_token = gen_random_uuid(), lease_expires_at = ${tsParam(lease)}, attempts = attempts + 1, claimed_at = ${tsParam(now)}
    where id in (
      select j.id from monitoring_jobs j
      join monitoring_tasks t on t.id = j.task_id
      join entitlements en on en.user_id = j.user_id and en.plan_id is not null
        and (en.valid_until is null or en.valid_until > ${tsParam(now)})
        and (j.kind = 'web_topic' or en.cloud_relay)
      where j.status = 'pending' and j.allow_cloud and j.slot_at <= ${tsParam(now)} and j.kind in ${kinds}
        and t.status in ('active', 'error')
        and (j.preferred_executor = 'cloud' or j.agent_deadline_at <= ${tsParam(now)})
      order by j.priority, j.slot_at
      limit ${Math.max(1, params.max)}
      for update of j skip locked
    )
    returning id, claim_token, lease_expires_at, task_id, user_id, kind, attempts`);
  return rows.map((r) => ({
    jobId: r.id,
    claimToken: r.claim_token,
    leaseExpiresAt: new Date(r.lease_expires_at),
    taskId: r.task_id,
    userId: r.user_id,
    kind: r.kind,
    attempts: r.attempts,
  }));
}

/** Prolonge le bail d'une tâche longue (navigateur) tant que son détenteur est actif. */
export async function extendLease(db: Executor, jobId: string, claimToken: string, seconds: number): Promise<boolean> {
  const r = await db.execute(sql`
    update monitoring_jobs set lease_expires_at = now() + make_interval(secs => ${seconds})
    where id = ${jobId} and claim_token = ${claimToken} and status = 'claimed'
    returning id`);
  return r.length === 1;
}

/** Crée une vérification immédiate (« Vérifier maintenant », première vérification). */
export async function enqueueImmediate(
  db: Database,
  params: { taskId: string; userId: string; manual: boolean; now?: Date; agentGraceSeconds?: number },
): Promise<string | null> {
  const now = params.now ?? new Date();
  return db.transaction(async (tx) => {
    const [task] = await tx.execute<{ kind: "page" | "web_topic"; execution_mode: "auto" | "local_only" | "cloud_only"; status: string; interval_minutes: number }>(sql`
      select t.kind, t.execution_mode, t.status, s.interval_minutes from monitoring_tasks t
      join monitoring_schedules s on s.task_id = t.id
      where t.id = ${params.taskId} and t.user_id = ${params.userId}`);
    if (!task || !["active", "error"].includes(task.status)) return null;
    const [ent] = await tx.select({ cloudRelay: entitlements.cloudRelay }).from(entitlements).where(eq(entitlements.userId, params.userId));
    const online = await onlineAgentUsers(tx, [params.userId], now);
    const d = decideExecutor({ kind: task.kind, executionMode: task.execution_mode, cloudRelay: ent?.cloudRelay ?? false, agentOnline: online.has(params.userId) });
    const deadline = d.allowCloud
      ? new Date(now.getTime() + (params.agentGraceSeconds ?? 120) * 1000)
      : new Date(now.getTime() + task.interval_minutes * 60_000);
    const r = await tx.execute<{ id: string }>(sql`
      insert into monitoring_jobs (task_id, user_id, kind, slot_at, preferred_executor, allow_cloud, allow_agent, agent_deadline_at, priority, manual)
      values (${params.taskId}, ${params.userId}, ${task.kind}, ${tsParam(now)}, ${d.preferred}, ${d.allowCloud}, ${d.allowAgent},
              ${d.preferred === "agent" ? tsParam(deadline) : null}, 10, ${params.manual})
      on conflict do nothing
      returning id`);
    return r[0]?.id ?? null;
  });
}
