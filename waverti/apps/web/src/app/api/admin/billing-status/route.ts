import { verifyPlanPrices } from "@waverti/billing";
import { json } from "@/lib/api";
import { withAdmin } from "@/lib/admin";
import { currentBillingMode, getStripe, isBillingConfigured } from "@/lib/stripe";

export const dynamic = "force-dynamic";

/**
 * État de la facturation pour l'administration : mode (jamais la clé), webhook configuré, et vérification
 * en lecture seule des 4 prix par clé de recherche — uniquement avec une clé de test (aucune clé live n'est utilisée ici).
 */
export const GET = withAdmin(async () => {
  const mode = currentBillingMode();
  const base = {
    mode,
    configured: isBillingConfigured(),
    webhookSecret: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
    webhookUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/api/stripe/webhook`,
  };
  if (mode !== "test" || !base.configured) return json({ ...base, prices: null });
  try {
    const { plans, retiredActive } = await verifyPlanPrices(getStripe());
    return json({ ...base, prices: plans, retiredActive });
  } catch {
    return json({ ...base, prices: null, error: "stripe_unreachable" });
  }
});
