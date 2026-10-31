import { z } from "zod";
import { advanceTestBilling } from "@waverti/billing";
import { apiError, json, readJson, withActor } from "@/lib/api";
import { getDb } from "@/lib/db";
import { getStripe, isBillingConfigured } from "@/lib/stripe";
import { testBillingToolsEnabled } from "@/lib/stripe-tools";

/**
 * Outil de recette (Preview uniquement, Stripe en mode TEST) : termine l'essai ou déclenche un renouvellement de
 * l'abonnement du compte connecté, sur les vrais serveurs Stripe TEST. Inexistant (404) en Production ou avec une
 * clé live : aucun paiement réel ne peut être déclenché par cette route.
 */
export const POST = withActor(
  async (req, actor) => {
    if (!testBillingToolsEnabled() || !isBillingConfigured()) return apiError(404, "not_found");
    const body = await readJson(req, z.object({ action: z.enum(["end_trial", "advance_days", "failing_card"]), days: z.number().int().min(1).max(62).optional() }));
    if (!body.ok) return body.res;
    const r = await advanceTestBilling(getDb(), getStripe(), actor.userId, body.data.action, body.data.days);
    return json({ ok: true, action: body.data.action, subscription: r.subscriptionId.slice(0, 8) + "…", frozenTime: r.frozenTime ?? null });
  },
  { rate: { name: "billing-test", limit: 20, windowSec: 3600 } },
);
