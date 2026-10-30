import { z } from "zod";
import { changePlan } from "@waverti/billing";
import { PAID_PLAN_IDS } from "@waverti/billing/catalog";
import { json, readJson, withActor } from "@/lib/api";
import { getDb } from "@/lib/db";
import { getStripe } from "@/lib/stripe";

export const POST = withActor(
  async (req, actor) => {
    const body = await readJson(req, z.object({ planId: z.enum(PAID_PLAN_IDS) }));
    if (!body.ok) return body.res;
    await changePlan(getDb(), getStripe(), actor.userId, body.data.planId);
    return json({ ok: true });
  },
  { rate: { name: "billing", limit: 20, windowSec: 3600 } },
);
