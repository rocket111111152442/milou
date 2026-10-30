import { z } from "zod";
import { setExtraSites } from "@waverti/billing";
import { json, readJson, withActor } from "@/lib/api";
import { getDb } from "@/lib/db";
import { getStripe } from "@/lib/stripe";

export const POST = withActor(
  async (req, actor) => {
    const body = await readJson(req, z.object({ quantity: z.number().int().min(0).max(20) }));
    if (!body.ok) return body.res;
    await setExtraSites(getDb(), getStripe(), actor.userId, body.data.quantity);
    return json({ ok: true });
  },
  { rate: { name: "billing", limit: 20, windowSec: 3600 } },
);
