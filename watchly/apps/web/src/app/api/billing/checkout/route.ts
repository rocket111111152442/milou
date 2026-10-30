import { z } from "zod";
import { createSubscriptionCheckout } from "@watchly/billing";
import { PAID_PLAN_IDS } from "@watchly/billing/catalog";
import { json, readJson, withActor } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { appUrl } from "@/lib/request";
import { getStripe } from "@/lib/stripe";

export const POST = withActor(
  async (req, actor) => {
    const body = await readJson(req, z.object({ planId: z.enum(PAID_PLAN_IDS), acknowledged: z.literal(true) }));
    if (!body.ok) return body.res;
    const user = await getCurrentUser();
    const res = await createSubscriptionCheckout(getDb(), getStripe(), {
      userId: actor.userId,
      email: user!.email,
      planId: body.data.planId,
      appUrl: appUrl(),
    });
    return json({ url: res.url });
  },
  { rate: { name: "checkout", limit: 10, windowSec: 3600 } },
);
