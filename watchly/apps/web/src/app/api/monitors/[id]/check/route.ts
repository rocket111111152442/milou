import { and, eq, isUuid, monitoringTasks } from "@watchly/database";
import { enqueueImmediate } from "@watchly/monitoring";
import { apiError, json, withActor } from "@/lib/api";
import { getDb } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";

/** « Vérifier maintenant » : limité pour préserver les sites surveillés et les coûts. */
export const POST = withActor(
  async (_req, actor, ctx) => {
    const { id } = await ctx.params;
    if (!isUuid(id)) return apiError(404, "not_found");
    const [task] = await getDb()
      .select({ id: monitoringTasks.id, kind: monitoringTasks.kind })
      .from(monitoringTasks)
      .where(and(eq(monitoringTasks.id, id!), eq(monitoringTasks.userId, actor.userId)))
      .limit(1);
    if (!task) return apiError(404, "not_found", "Surveillance introuvable.");
    const perTask = await rateLimit(`check:${task.id}`, 1, task.kind === "web_topic" ? 6 * 3600 : 600);
    const perDay = await rateLimit(`check-day:${actor.userId}`, 30, 86_400);
    if (!perTask.ok || !perDay.ok) {
      return apiError(429, "rate_limited", task.kind === "web_topic" ? "Une recherche manuelle toutes les 6 heures au maximum." : "Une vérification manuelle toutes les 10 minutes au maximum.", { retryAfter: perTask.retryAfterSec });
    }
    const jobId = await enqueueImmediate(getDb(), { taskId: task.id, userId: actor.userId, manual: true });
    if (!jobId) return apiError(409, "already_queued", "Une vérification est déjà en cours pour cette surveillance.");
    return json({ ok: true, jobId }, 202);
  },
  { allowDevice: true },
);
