import { z } from "zod";
import { isUuid } from "@waverti/database";
import { verifySite } from "@waverti/monitoring/business";
import { apiError, json, readJson, withActor } from "@/lib/api";
import { getDb } from "@/lib/db";

/** Vérification de propriété (DNS TXT ou fichier), effectuée par le serveur. */
export const POST = withActor(
  async (req, actor, ctx) => {
    const { id } = await ctx.params;
    if (!isUuid(id)) return apiError(404, "not_found");
    const body = await readJson(req, z.object({ method: z.enum(["dns", "file"]) }));
    if (!body.ok) return body.res;
    const r = await verifySite(getDb(), actor.userId, id!, body.data.method);
    return json(r);
  },
  { rate: { name: "site_verify", limit: 60, windowSec: 3600 } },
);
