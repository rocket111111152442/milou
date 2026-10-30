/**
 * Enregistrement d'un résultat de contrôle (par l'application desktop ou un worker).
 * Idempotent (un résultat par tâche planifiée), protégé par le jeton de réservation :
 * un exécutant dont le bail a expiré ne peut plus écrire de résultat.
 */
import {
  desc,
  eq,
  monitoringResults,
  monitoringTasks,
  sql,
  and,
  isNotNull,
  ne,
  tsParam,
  type Database,
  type Transaction,
} from "@waverti/database";
import { notify } from "@waverti/notifications";
import {
  pageConditionSchema,
  pageObservationSchema,
  webTopicObservationSchema,
  type PageObservation,
  type WebTopicObservation,
} from "@waverti/types";
import { evaluatePage, type Evaluation } from "./compare/evaluate";

export class StaleClaimError extends Error {
  readonly code = "stale_claim";
  constructor() {
    super("Réservation expirée ou invalide");
    this.name = "StaleClaimError";
  }
}

export interface SubmitInput {
  jobId: string;
  claimToken: string;
  executor: "agent" | "cloud";
  deviceId?: string | null;
  durationMs: number;
  observation?: PageObservation | WebTopicObservation;
  error?: { code: string; message: string };
  fromCache?: boolean;
  /** Évaluation déjà calculée par le moteur de recherche (moteur B). */
  webEvaluation?: Evaluation;
  now?: Date;
}

export interface SubmitOutcome {
  resultId: string;
  outcome: Evaluation["outcome"];
  triggered: boolean;
  summary: string;
  notificationId: string | null;
  duplicate: boolean;
}

const ALERT_TYPE = { price: "price", stock: "stock", page_change: "page_change", keyword: "keyword", web_topic: "web_topic" } as const;
const MAX_CONSECUTIVE_ERRORS_BEFORE_ERROR_STATE = 5;

async function previousPageObservation(tx: Transaction, taskId: string): Promise<PageObservation | null> {
  const [row] = await tx
    .select({ observation: monitoringResults.observation })
    .from(monitoringResults)
    .where(and(eq(monitoringResults.taskId, taskId), ne(monitoringResults.outcome, "error"), isNotNull(monitoringResults.observation)))
    .orderBy(desc(monitoringResults.checkedAt))
    .limit(1);
  const parsed = pageObservationSchema.safeParse(row?.observation);
  return parsed.success ? parsed.data : null;
}

export async function submitResult(db: Database, input: SubmitInput): Promise<SubmitOutcome> {
  const now = input.now ?? new Date();
  return db.transaction(async (tx) => {
    const [job] = await tx.execute<{
      id: string;
      task_id: string;
      user_id: string;
      status: string;
      claim_token: string | null;
      claimed_by: string | null;
      claimed_device_id: string | null;
      kind: "page" | "web_topic";
    }>(sql`select id, task_id, user_id, status, claim_token, claimed_by, claimed_device_id, kind from monitoring_jobs where id = ${input.jobId} for update`);
    if (!job) throw new StaleClaimError();

    // Résultat déjà enregistré pour cette tâche (nouvelle tentative réseau du client) : idempotence.
    const [existing] = await tx
      .select({ id: monitoringResults.id, outcome: monitoringResults.outcome })
      .from(monitoringResults)
      .where(eq(monitoringResults.jobId, input.jobId))
      .limit(1);
    if (existing) {
      if (job.claim_token !== null && job.claim_token !== input.claimToken) throw new StaleClaimError();
      return { resultId: existing.id, outcome: existing.outcome, triggered: existing.outcome === "triggered", summary: "", notificationId: null, duplicate: true };
    }
    if (job.status !== "claimed" || job.claim_token !== input.claimToken || job.claimed_by !== input.executor) throw new StaleClaimError();
    if (input.executor === "agent" && job.claimed_device_id !== input.deviceId) throw new StaleClaimError();

    const [task] = await tx.select().from(monitoringTasks).where(eq(monitoringTasks.id, job.task_id)).limit(1);
    if (!task) throw new StaleClaimError();

    let evaluation: Evaluation;
    let observation: Record<string, unknown> | null = null;
    if (input.error || !input.observation) {
      evaluation = {
        outcome: "error",
        triggered: false,
        summary: input.error?.message?.slice(0, 300) || "Le contrôle a échoué.",
        value: null,
        alert: null,
        changeSummary: null,
        errorCode: input.error?.code?.slice(0, 60) ?? "unknown_error",
      };
    } else if (job.kind === "page") {
      const obs = pageObservationSchema.parse(input.observation);
      const cond = pageConditionSchema.parse(task.condition);
      const prev = await previousPageObservation(tx, task.id);
      evaluation = evaluatePage(cond, prev, obs, task.name);
      observation = obs as unknown as Record<string, unknown>;
    } else {
      const obs = webTopicObservationSchema.parse(input.observation);
      if (!input.webEvaluation) throw new Error("webEvaluation requise pour une recherche Web");
      evaluation = input.webEvaluation;
      observation = obs as unknown as Record<string, unknown>;
    }

    const [result] = await tx
      .insert(monitoringResults)
      .values({
        jobId: job.id,
        taskId: task.id,
        userId: task.userId,
        executedBy: input.executor,
        deviceId: input.executor === "agent" ? (input.deviceId ?? null) : null,
        checkedAt: now,
        outcome: evaluation.outcome,
        observation,
        changeSummary: evaluation.changeSummary,
        errorCode: evaluation.errorCode,
        errorMessage: evaluation.outcome === "error" ? evaluation.summary : null,
        durationMs: input.durationMs,
        fromCache: Boolean(input.fromCache),
      })
      .returning({ id: monitoringResults.id });

    await tx.execute(sql`
      update monitoring_jobs set status = 'succeeded', finished_at = ${tsParam(now)}, lease_expires_at = null,
             last_error = ${evaluation.outcome === "error" ? evaluation.errorCode : null}
      where id = ${job.id}`);

    const errors = evaluation.outcome === "error" ? task.consecutiveErrors + 1 : 0;
    await tx
      .update(monitoringTasks)
      .set({
        lastCheckedAt: now,
        lastStatus: evaluation.outcome === "error" ? "error" : evaluation.triggered ? "triggered" : "ok",
        lastError: evaluation.outcome === "error" ? evaluation.summary : null,
        consecutiveErrors: errors,
        ...(evaluation.triggered ? { lastTriggeredAt: now } : {}),
        ...(task.status === "active" && errors >= MAX_CONSECUTIVE_ERRORS_BEFORE_ERROR_STATE ? { status: "error" as const } : {}),
        ...(task.status === "error" && errors === 0 ? { status: "active" as const } : {}),
      })
      .where(eq(monitoringTasks.id, task.id));

    let notificationId: string | null = null;
    if (evaluation.alert) {
      const sourceUrl =
        observation && typeof observation.finalUrl === "string"
          ? observation.finalUrl
          : (evaluation.changeSummary?.sourceUrl as string | undefined) ?? null;
      const n = await notify(tx, {
        userId: task.userId,
        type: ALERT_TYPE[evaluation.alert.kind as keyof typeof ALERT_TYPE] ?? "page_change",
        priority: "normal",
        title: evaluation.alert.title,
        body: evaluation.alert.body,
        taskId: task.id,
        taskName: task.name,
        resultId: result!.id,
        sourceUrl,
        linkPath: `/app/surveillances/${task.id}`,
        dedupKey: `result:${result!.id}`,
        emailPolicy: task.notifyEmail ? "alert" : "none",
        emailPayload: { detectedAt: now.toLocaleString("fr-FR", { timeZone: "Europe/Paris" }), ctaLabel: "Voir le résultat" },
      });
      notificationId = n?.notificationId ?? null;
    } else if (errors === MAX_CONSECUTIVE_ERRORS_BEFORE_ERROR_STATE) {
      const n = await notify(tx, {
        userId: task.userId,
        type: "system",
        priority: "normal",
        title: "Une surveillance rencontre des erreurs",
        body: `${task.name} : les ${errors} derniers contrôles ont échoué (${evaluation.summary}). Vérifiez l'adresse ou la condition.`,
        taskId: task.id,
        taskName: task.name,
        linkPath: `/app/surveillances/${task.id}`,
        dedupKey: `errors:${task.id}:${now.toISOString().slice(0, 10)}`,
        emailPolicy: "none",
      });
      notificationId = n?.notificationId ?? null;
    }

    return {
      resultId: result!.id,
      outcome: evaluation.outcome,
      triggered: evaluation.triggered,
      summary: evaluation.summary,
      notificationId,
      duplicate: false,
    };
  });
}
