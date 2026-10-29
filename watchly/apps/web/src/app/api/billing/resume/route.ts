import { resumeSubscription } from "@watchly/billing";
import { json, withActor } from "@/lib/api";
import { getDb } from "@/lib/db";
import { getStripe } from "@/lib/stripe";

export const POST = withActor(
  async (_req, actor) => {
    await resumeSubscription(getDb(), getStripe(), actor.userId);
    return json({ ok: true });
  },
  { rate: { name: "billing", limit: 20, windowSec: 3600 } },
);
