import { isUuid } from "@watchly/database";
import { createScenario } from "@watchly/monitoring/business";
import { scenarioInputSchema } from "@watchly/types";
import { apiError, json, readJson, withActor } from "@/lib/api";
import { getDb } from "@/lib/db";

export const POST = withActor(
  async (req, actor, ctx) => {
    const { id } = await ctx.params;
    if (!isUuid(id)) return apiError(404, "not_found");
    const body = await readJson(req, scenarioInputSchema);
    if (!body.ok) return body.res;
    return json(await createScenario(getDb(), actor.userId, id!, body.data), 201);
  },
  { rate: { name: "scenario_create", limit: 30, windowSec: 3600 } },
);
