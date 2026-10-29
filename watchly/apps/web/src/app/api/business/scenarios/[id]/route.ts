import { z } from "zod";
import { isUuid } from "@watchly/database";
import { deleteScenario, setScenarioEnabled } from "@watchly/monitoring/business";
import { apiError, json, readJson, withActor } from "@/lib/api";
import { getDb } from "@/lib/db";

export const PATCH = withActor(async (req, actor, ctx) => {
  const { id } = await ctx.params;
  if (!isUuid(id)) return apiError(404, "not_found");
  const body = await readJson(req, z.object({ enabled: z.boolean() }));
  if (!body.ok) return body.res;
  await setScenarioEnabled(getDb(), actor.userId, id!, body.data.enabled);
  return json({ ok: true });
});

export const DELETE = withActor(async (_req, actor, ctx) => {
  const { id } = await ctx.params;
  if (!isUuid(id)) return apiError(404, "not_found");
  await deleteScenario(getDb(), actor.userId, id!);
  return json({ ok: true });
});
