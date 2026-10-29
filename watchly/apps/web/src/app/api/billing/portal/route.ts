import { createPortalSession } from "@watchly/billing";
import { json, withActor } from "@/lib/api";
import { getDb } from "@/lib/db";
import { appUrl } from "@/lib/request";
import { getStripe } from "@/lib/stripe";

export const POST = withActor(
  async (_req, actor) => {
    const url = await createPortalSession(getDb(), getStripe(), actor.userId, `${appUrl()}/app/abonnement`);
    return json({ url });
  },
  { rate: { name: "billing", limit: 20, windowSec: 3600 } },
);
