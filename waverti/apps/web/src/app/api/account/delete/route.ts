import { createHash } from "node:crypto";
import { z } from "zod";
import { accountDeletions, adminAuditLogs, eq, profiles } from "@waverti/database";
import { getLiveSubscription } from "@waverti/billing";
import { apiError, json, readJson, withActor } from "@/lib/api";
import { getDb } from "@/lib/db";
import { getStripe, isBillingConfigured } from "@/lib/stripe";
import { deleteAccount } from "@waverti/auth";
import { endSession } from "@/lib/session";

/**
 * Suppression du compte (droit à l'effacement) : abonnement Stripe annulé immédiatement,
 * puis suppression de l'utilisateur d'authentification (cascade sur toutes ses données).
 * Seule une trace pseudonymisée est conservée (preuve de traitement de la demande).
 */
export const POST = withActor(
  async (req, actor) => {
    const body = await readJson(req, z.object({ confirmation: z.literal("SUPPRIMER") }));
    if (!body.ok) return apiError(422, "confirmation_required", "Tapez SUPPRIMER pour confirmer.");
    const db = getDb();
    const [p] = await db.select({ createdAt: profiles.createdAt, role: profiles.role }).from(profiles).where(eq(profiles.id, actor.userId));
    if (p?.role === "admin") return apiError(409, "admin_account", "Un compte administrateur doit d'abord être rétrogradé par la procédure dédiée.");
    let stripeCancellation = "none";
    const sub = await getLiveSubscription(db, actor.userId);
    if (sub) {
      if (!isBillingConfigured()) return apiError(503, "billing_unavailable", "Résiliation impossible pour le moment, réessayez plus tard.");
      await getStripe().subscriptions.cancel(sub.stripeSubscriptionId, { prorate: false, invoice_now: false });
      stripeCancellation = "canceled";
    }
    const ref = createHash("sha256").update(`${process.env.WAVERTI_HASH_PEPPER ?? ""}:${actor.userId}`).digest("hex").slice(0, 32);
    await db.insert(accountDeletions).values({ userRef: ref, requestedAt: new Date(), stripeCancellation });
    await db.insert(adminAuditLogs).values({ adminId: null, action: "account.self_delete", targetType: "user", targetId: ref, metadata: {} });
    // Suppression de l'identité : cascade sur le profil, les sessions, les surveillances et toutes les données.
    await deleteAccount(db, actor.userId);
    await endSession().catch(() => undefined);
    return json({ ok: true });
  },
  { rate: { name: "delete", limit: 3, windowSec: 3600 } },
);
