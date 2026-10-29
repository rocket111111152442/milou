/**
 * Service des surveillances : toutes les écritures passent ici, après validation serveur
 * (quotas de la formule, URL sûre, condition cohérente). Le client ne peut fixer ni ses quotas,
 * ni une fréquence inférieure à sa formule, ni un mode d'exécution non autorisé.
 */
import { createHash } from "node:crypto";
import {
  and,
  eq,
  monitoringJobs,
  monitoringSchedules,
  monitoringTargets,
  monitoringTasks,
  profiles,
  sql,
  type Database,
} from "@watchly/database";
import { checkNewMonitor, getEntitlements, QuotaError, resolveSettings } from "@watchly/billing";
import {
  pageConditionSchema,
  webTopicConditionSchema,
  type CreateMonitorInput,
  type UpdateMonitorInput,
} from "@watchly/types";
import { canonicalUrl, InvalidTargetError, parseTargetUrl } from "./net/safe-url";
import { buildQueries, planWebTopic } from "./search/planner";
import { stableJitterSeconds } from "./schedule/next-run";
import { decideExecutor } from "./queue";

export class MonitorError extends Error {
  constructor(
    public readonly code: "not_found" | "invalid_target" | "invalid_condition" | "quota" | "state",
    message: string,
    public readonly status = 422,
  ) {
    super(message);
    this.name = "MonitorError";
  }
}

export function urlHash(url: string): string {
  return createHash("sha256").update(url).digest("hex");
}

export interface CreatedMonitor {
  id: string;
  intervalMinutes: number;
  executionMode: "auto" | "local_only" | "cloud_only";
  initialJobId: string | null;
}

export async function createMonitor(db: Database, userId: string, input: CreateMonitorInput, now: Date = new Date()): Promise<CreatedMonitor> {
  const ent = await getEntitlements(db, userId, now);

  let target: typeof monitoringTargets.$inferInsert;
  let condition: Record<string, unknown>;
  if (input.kind === "page") {
    let url: URL;
    try {
      url = parseTargetUrl(input.url);
    } catch (err) {
      if (err instanceof InvalidTargetError) throw new MonitorError("invalid_target", err.message);
      throw err;
    }
    const canonical = canonicalUrl(url);
    condition = pageConditionSchema.parse(input.condition);
    target = {
      taskId: "",
      userId,
      targetType: "url",
      url: canonical,
      urlHash: urlHash(canonical),
      host: url.hostname.toLowerCase(),
      cssSelector: input.cssSelector || null,
      renderMode: input.renderMode,
    };
  } else {
    const plan = planWebTopic(input.request, {
      subject: input.condition?.subject,
      officialDomains: input.officialDomains,
      requireOfficial: input.condition?.requireOfficial,
      keywords: input.condition?.keywords,
    });
    const cond = input.condition ? webTopicConditionSchema.parse({ ...plan.condition, ...input.condition }) : plan.condition;
    condition = cond;
    target = {
      taskId: "",
      userId,
      targetType: "search_topic",
      topic: input.request,
      searchQueries: buildQueries(cond, input.officialDomains),
      officialDomains: input.officialDomains,
      requireOfficial: cond.requireOfficial,
    };
  }

  return db.transaction(async (tx) => {
    // Verrou par utilisateur : deux créations simultanées ne peuvent pas dépasser le quota.
    const [locked] = await tx.select({ id: profiles.id, suspendedAt: profiles.suspendedAt }).from(profiles).where(eq(profiles.id, userId)).for("update");
    if (!locked) throw new MonitorError("not_found", "Compte introuvable", 404);
    if (locked.suspendedAt) throw new MonitorError("state", "Compte suspendu", 403);
    const [counts] = await tx.execute<{ total: number; topics: number }>(sql`
      select count(*)::int as total, count(*) filter (where kind = 'web_topic')::int as topics
      from monitoring_tasks where user_id = ${userId}`);
    const settings = checkNewMonitor(ent, { total: counts?.total ?? 0, webTopics: counts?.topics ?? 0 }, {
      kind: input.kind,
      intervalMinutes: input.intervalMinutes,
      executionMode: input.kind === "page" ? input.executionMode : "cloud_only",
    });

    const [task] = await tx
      .insert(monitoringTasks)
      .values({
        userId,
        kind: input.kind,
        name: input.name,
        condition,
        executionMode: settings.executionMode,
        notifyInapp: input.notify.inapp,
        notifyEmail: input.notify.email,
        notifyDesktop: input.notify.desktop,
      })
      .returning({ id: monitoringTasks.id });
    const id = task!.id;
    await tx.insert(monitoringTargets).values({ ...target, taskId: id });
    const jitter = stableJitterSeconds(id, Math.min(600, settings.intervalMinutes * 6));
    await tx.insert(monitoringSchedules).values({
      taskId: id,
      userId,
      intervalMinutes: settings.intervalMinutes,
      // Première vérification immédiate (job ci-dessous), puis rythme régulier décalé pour lisser la charge.
      nextRunAt: new Date(now.getTime() + settings.intervalMinutes * 60_000 + jitter * 1000),
      jitterSeconds: jitter,
    });
    // Premier contrôle immédiat : côté serveur si la formule le permet (résultat visible en quelques
    // secondes), sinon par l'application desktop (formule Découverte).
    const d = decideExecutor({ kind: input.kind, executionMode: settings.executionMode, cloudRelay: ent.cloudRelay, agentOnline: false });
    const deadline = d.allowCloud ? now : new Date(now.getTime() + settings.intervalMinutes * 60_000);
    const initial = await tx
      .insert(monitoringJobs)
      .values({
        taskId: id,
        userId,
        kind: input.kind,
        slotAt: now,
        preferredExecutor: d.preferred,
        allowCloud: d.allowCloud,
        allowAgent: d.allowAgent,
        agentDeadlineAt: d.preferred === "agent" ? deadline : null,
        priority: 20,
      })
      .onConflictDoNothing()
      .returning({ id: monitoringJobs.id });
    return { id, intervalMinutes: settings.intervalMinutes, executionMode: settings.executionMode, initialJobId: initial[0]?.id ?? null };
  });
}

async function ownTask(db: Database, userId: string, taskId: string) {
  const [task] = await db
    .select()
    .from(monitoringTasks)
    .where(and(eq(monitoringTasks.id, taskId), eq(monitoringTasks.userId, userId)))
    .limit(1);
  if (!task) throw new MonitorError("not_found", "Surveillance introuvable", 404);
  return task;
}

export async function updateMonitor(db: Database, userId: string, taskId: string, input: UpdateMonitorInput, now: Date = new Date()): Promise<void> {
  const task = await ownTask(db, userId, taskId);
  const ent = await getEntitlements(db, userId, now);
  const patch: Partial<typeof monitoringTasks.$inferInsert> = {};
  if (input.name) patch.name = input.name;
  if (input.condition) {
    if (task.kind === "page") patch.condition = pageConditionSchema.parse(input.condition);
    else patch.condition = webTopicConditionSchema.parse(input.condition);
  }
  if (input.notify?.inapp !== undefined) patch.notifyInapp = input.notify.inapp;
  if (input.notify?.email !== undefined) patch.notifyEmail = input.notify.email;
  if (input.notify?.desktop !== undefined) patch.notifyDesktop = input.notify.desktop;
  let settings: ReturnType<typeof resolveSettings> | null = null;
  if (input.intervalMinutes !== undefined || input.executionMode !== undefined) {
    settings = resolveSettings(ent, { kind: task.kind, intervalMinutes: input.intervalMinutes, executionMode: input.executionMode ?? task.executionMode });
    patch.executionMode = settings.executionMode;
  }
  await db.transaction(async (tx) => {
    if (Object.keys(patch).length) await tx.update(monitoringTasks).set(patch).where(eq(monitoringTasks.id, taskId));
    if (input.cssSelector !== undefined && task.kind === "page") {
      await tx.update(monitoringTargets).set({ cssSelector: input.cssSelector || null }).where(eq(monitoringTargets.taskId, taskId));
    }
    if (input.officialDomains && task.kind === "web_topic") {
      const cond = webTopicConditionSchema.parse(patch.condition ?? task.condition);
      await tx
        .update(monitoringTargets)
        .set({ officialDomains: input.officialDomains, searchQueries: buildQueries(cond, input.officialDomains), requireOfficial: cond.requireOfficial })
        .where(eq(monitoringTargets.taskId, taskId));
    } else if (patch.condition && task.kind === "web_topic") {
      const cond = webTopicConditionSchema.parse(patch.condition);
      const [t] = await tx.select({ d: monitoringTargets.officialDomains }).from(monitoringTargets).where(eq(monitoringTargets.taskId, taskId));
      await tx.update(monitoringTargets).set({ searchQueries: buildQueries(cond, t?.d ?? []), requireOfficial: cond.requireOfficial }).where(eq(monitoringTargets.taskId, taskId));
    }
    if (settings && input.intervalMinutes !== undefined) {
      await tx
        .update(monitoringSchedules)
        .set({ intervalMinutes: settings.intervalMinutes, nextRunAt: new Date(now.getTime() + settings.intervalMinutes * 60_000) })
        .where(eq(monitoringSchedules.taskId, taskId));
    }
  });
}

export async function setMonitorPaused(db: Database, userId: string, taskId: string, paused: boolean, now: Date = new Date()): Promise<void> {
  const task = await ownTask(db, userId, taskId);
  if (paused) {
    await db.transaction(async (tx) => {
      await tx.update(monitoringTasks).set({ status: "paused" }).where(eq(monitoringTasks.id, taskId));
      await tx
        .update(monitoringJobs)
        .set({ status: "canceled", finishedAt: now })
        .where(and(eq(monitoringJobs.taskId, taskId), eq(monitoringJobs.status, "pending")));
    });
    return;
  }
  if (task.status === "paused_quota") {
    const ent = await getEntitlements(db, userId, now);
    const [c] = await db.execute<{ active: number }>(sql`
      select count(*)::int as active from monitoring_tasks where user_id = ${userId} and status <> 'paused_quota'`);
    if ((c?.active ?? 0) >= ent.maxMonitors) {
      throw new QuotaError("monitor_limit", "Votre formule ne permet pas de réactiver cette surveillance. Supprimez-en une autre ou changez de formule.");
    }
  }
  await db.transaction(async (tx) => {
    await tx.update(monitoringTasks).set({ status: "active", consecutiveErrors: 0 }).where(eq(monitoringTasks.id, taskId));
    const [s] = await tx.select().from(monitoringSchedules).where(eq(monitoringSchedules.taskId, taskId));
    if (s && s.nextRunAt.getTime() < now.getTime()) {
      await tx.update(monitoringSchedules).set({ nextRunAt: now }).where(eq(monitoringSchedules.taskId, taskId));
    }
  });
}

export async function deleteMonitor(db: Database, userId: string, taskId: string): Promise<void> {
  const r = await db
    .delete(monitoringTasks)
    .where(and(eq(monitoringTasks.id, taskId), eq(monitoringTasks.userId, userId)))
    .returning({ id: monitoringTasks.id });
  if (!r.length) throw new MonitorError("not_found", "Surveillance introuvable", 404);
}
