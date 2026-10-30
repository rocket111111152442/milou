import { isUuid } from "@waverti/database";
import { runScenarioSoon } from "@waverti/monitoring/business";
import { apiError, json, withActor } from "@/lib/api";
import { getDb } from "@/lib/db";

/** Demande une exécution prochaine (le worker l'exécute ; au plus une fois toutes les 10 minutes). */
export const POST = withActor(async (_req, actor, ctx) => {
  const { id } = await ctx.params;
  if (!isUuid(id)) return apiError(404, "not_found");
  await runScenarioSoon(getDb(), actor.userId, id!);
  return json({ ok: true });
});
