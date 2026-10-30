import { z } from "zod";
import { planWebTopic } from "@waverti/monitoring";
import { json, readJson, withActor } from "@/lib/api";

/** Analyse (déterministe, sans coût d'API) d'une demande de recherche sur Internet. */
export const POST = withActor(
  async (req) => {
    const body = await readJson(req, z.object({ request: z.string().trim().min(3).max(500), officialDomains: z.array(z.string().max(255)).max(5).optional() }));
    if (!body.ok) return body.res;
    return json(planWebTopic(body.data.request, { officialDomains: body.data.officialDomains }));
  },
  { allowDevice: true, rate: { name: "plan", limit: 120, windowSec: 3600 } },
);
