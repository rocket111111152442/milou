import { agentDevices, and, eq, isUuid } from "@watchly/database";
import { apiError, json, withActor } from "@/lib/api";
import { getDb } from "@/lib/db";

/** Révocation d'un appareil depuis le web (perte, vol, ancien ordinateur). */
export const DELETE = withActor(async (_req, actor, ctx) => {
  const { id } = await ctx.params;
  if (!isUuid(id)) return apiError(404, "not_found");
  const r = await getDb()
    .update(agentDevices)
    .set({ status: "revoked", revokedAt: new Date(), monitoringEnabled: false })
    .where(and(eq(agentDevices.id, id!), eq(agentDevices.userId, actor.userId)))
    .returning({ id: agentDevices.id });
  if (!r.length) return apiError(404, "not_found");
  return json({ ok: true });
});
