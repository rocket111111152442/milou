import { scheduleCancellation } from "@watchly/billing";
import { json, withActor } from "@/lib/api";
import { getDb } from "@/lib/db";
import { getStripe } from "@/lib/stripe";

export const POST = withActor(
  async (_req, actor) => {
    const r = await scheduleCancellation(getDb(), getStripe(), actor.userId);
    return json({ ok: true, endsAt: r.endsAt?.toISOString() ?? null, trial: r.trial });
  },
  { rate: { name: "billing", limit: 20, windowSec: 3600 } },
);
