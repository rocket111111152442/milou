import { isUuid } from "@waverti/database";
import { deleteSite } from "@waverti/monitoring/business";
import { apiError, json, withActor } from "@/lib/api";
import { getDb } from "@/lib/db";

export const DELETE = withActor(async (_req, actor, ctx) => {
  const { id } = await ctx.params;
  if (!isUuid(id)) return apiError(404, "not_found");
  await deleteSite(getDb(), actor.userId, id!);
  return json({ ok: true });
});
