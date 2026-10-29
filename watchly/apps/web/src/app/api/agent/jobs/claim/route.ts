import { inArray, monitoringTargets, monitoringTasks, eq } from "@watchly/database";
import { claimAgentJobs } from "@watchly/monitoring";
import { claimRequestSchema, type AgentJob } from "@watchly/types";
import { readJson } from "@/lib/api";
import { noStore, withDevice } from "@/lib/agent";
import { getDb } from "@/lib/db";

/** L'application réserve des contrôles — uniquement ceux de SON utilisateur, jamais d'un autre. */
export const POST = withDevice(
  async (req, device) => {
    const body = await readJson(req, claimRequestSchema);
    if (!body.ok) return body.res;
    const db = getDb();
    const claims = await claimAgentJobs(db, { userId: device.userId, deviceId: device.deviceId, max: body.data.max, leaseSeconds: 180 });
    if (!claims.length) return noStore({ jobs: [] });
    const rows = await db
      .select({ id: monitoringTasks.id, name: monitoringTasks.name, url: monitoringTargets.url, cssSelector: monitoringTargets.cssSelector, renderMode: monitoringTargets.renderMode })
      .from(monitoringTasks)
      .innerJoin(monitoringTargets, eq(monitoringTargets.taskId, monitoringTasks.id))
      .where(inArray(monitoringTasks.id, claims.map((c) => c.taskId)));
    const byId = new Map(rows.map((r) => [r.id, r]));
    const jobs: AgentJob[] = claims
      .filter((c) => byId.get(c.taskId)?.url)
      .map((c) => {
        const t = byId.get(c.taskId)!;
        return {
          jobId: c.jobId,
          claimToken: c.claimToken,
          leaseExpiresAt: c.leaseExpiresAt.toISOString(),
          task: { id: t.id, name: t.name, kind: "page", url: t.url!, cssSelector: t.cssSelector, renderMode: t.renderMode },
        };
      });
    return noStore({ jobs });
  },
  { requireConsent: true, rate: { name: "claim", limit: 720, windowSec: 3600 } },
);
