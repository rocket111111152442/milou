import { isUuid } from "@watchly/database";
import { StaleClaimError, submitResult } from "@watchly/monitoring";
import { jobResultSchema } from "@watchly/types";
import { apiError, readJson } from "@/lib/api";
import { noStore, withDevice } from "@/lib/agent";
import { getDb } from "@/lib/db";

export const POST = withDevice(
  async (req, device, ctx) => {
    const { id } = await ctx.params;
    if (!isUuid(id)) return apiError(404, "not_found");
    const body = await readJson(req, jobResultSchema);
    if (!body.ok) return body.res;
    try {
      const r = await submitResult(getDb(), {
        jobId: id!,
        claimToken: body.data.claimToken,
        executor: "agent",
        deviceId: device.deviceId,
        durationMs: body.data.durationMs,
        observation: body.data.observation,
        error: body.data.error,
      });
      return noStore({ ok: true, outcome: r.outcome, triggered: r.triggered, summary: r.summary, duplicate: r.duplicate });
    } catch (err) {
      if (err instanceof StaleClaimError) return apiError(409, "stale_claim", "Ce contrôle a été réattribué (délai dépassé).");
      throw err;
    }
  },
  { requireConsent: true, rate: { name: "result", limit: 720, windowSec: 3600 } },
);
