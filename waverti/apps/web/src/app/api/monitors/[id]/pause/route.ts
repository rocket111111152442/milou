import { isUuid } from "@waverti/database";
import { setMonitorPaused } from "@waverti/monitoring";
import { apiError, json, withActor } from "@/lib/api";
import { getDb } from "@/lib/db";
import { monitorError } from "@/lib/monitor-api";

export const POST = withActor(
  async (_req, actor, ctx) => {
    const { id } = await ctx.params;
    if (!isUuid(id)) return apiError(404, "not_found");
    try {
      await setMonitorPaused(getDb(), actor.userId, id!, true);
      return json({ ok: true });
    } catch (err) {
      return monitorError(err);
    }
  },
  { allowDevice: true, rate: { name: "monitor_write", limit: 200, windowSec: 3600 } },
);
