import { json, withActor } from "@/lib/api";
import { listHistory, toResultView } from "@/lib/data/monitors";

/** Historique des contrôles de toutes les surveillances (web et application desktop). */
export const GET = withActor(
  async (req, actor) => {
    const limit = Math.min(500, Math.max(1, Number(new URL(req.url).searchParams.get("limit") ?? 200) || 200));
    const rows = await listHistory(actor.userId, limit);
    return json({
      results: rows.map((r) => ({ ...toResultView(r.result, r.condition), monitorId: r.result.taskId, monitorName: r.name })),
    });
  },
  { allowDevice: true },
);
