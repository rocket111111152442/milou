import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { formatDateTime } from "@waverti/types";
import { Celebration } from "@/components/app/celebration";
import { requireUser } from "@/lib/auth";
import { testBillingToolsEnabled } from "@/lib/stripe-tools";

export const metadata: Metadata = { title: "Aperçu de l'animation d'achat" };

/**
 * Aperçu de l'animation de confirmation d'achat, pour la recette visuelle uniquement (mêmes conditions que les outils de recette Stripe :
 * jamais en Production). Aucun paiement, aucune donnée de compte : valeurs d'exemple.
 */
export default async function PurchaseAnimationPreview() {
  await requireUser("/app/abonnement/apercu-achat");
  if (!testBillingToolsEnabled()) notFound();
  return (
    <div className="mx-auto max-w-lg py-16 text-center text-sm text-ink-soft">
      <p>Aperçu de l'animation d'achat validé (valeurs d'exemple).</p>
      <Celebration storageKey={`apercu-achat-${Date.now()}`} planName="Pro" trialing trialEndsAtLabel={formatDateTime(new Date(Date.now() + 72 * 3600 * 1000).toISOString())} />
    </div>
  );
}
