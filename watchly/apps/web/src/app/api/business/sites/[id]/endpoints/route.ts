import { isUuid } from "@watchly/database";
import { createEndpoint } from "@watchly/monitoring/business";
import { endpointInputSchema } from "@watchly/types";
import { apiError, json, readJson, withActor } from "@/lib/api";
import { getDb } from "@/lib/db";

export const POST = withActor(
  async (req, actor, ctx) => {
    const { id } = await ctx.params;
    if (!isUuid(id)) return apiError(404, "not_found");
    const body = await readJson(req, endpointInputSchema);
    if (!body.ok) return body.res;
    return json(await createEndpoint(getDb(), actor.userId, id!, body.data), 201);
  },
  { rate: { name: "endpoint_create", limit: 60, windowSec: 3600 } },
);
