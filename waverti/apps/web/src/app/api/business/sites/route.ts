import { createSite } from "@waverti/monitoring/business";
import { siteInputSchema } from "@waverti/types";
import { json, readJson, withActor } from "@/lib/api";
import { listSites } from "@/lib/data/business";
import { getDb } from "@/lib/db";

export const GET = withActor(async (_req, actor) => json({ sites: await listSites(actor.userId) }));

export const POST = withActor(
  async (req, actor) => {
    const body = await readJson(req, siteInputSchema);
    if (!body.ok) return body.res;
    const site = await createSite(getDb(), actor.userId, body.data);
    return json({ id: site.id }, 201);
  },
  { rate: { name: "site_create", limit: 20, windowSec: 3600 } },
);
