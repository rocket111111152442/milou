import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@waverti/ui";
import { PLAN_CATALOG, isPaidPlanId } from "@waverti/billing/catalog";
import { formatCents } from "@waverti/types";
import { AuthCard } from "../auth-card";
import { SignUpForm } from "../auth-forms";

export const metadata: Metadata = { title: "Créer un compte", robots: { index: false } };

export default async function InscriptionPage({ searchParams }: { searchParams: Promise<{ formule?: string }> }) {
  const { formule } = await searchParams;
  const plan = isPaidPlanId(formule) ? PLAN_CATALOG[formule] : null;
  return (
    <AuthCard
      title="Créer votre compte Waverti"
      description={
        plan ? (
          <span className="flex flex-col gap-2">
            <span>
              Vous avez choisi <strong className="text-ink">{plan.name}</strong> ({formatCents(plan.priceCents)}/mois). Après
              vérification de votre e-mail, vous pourrez démarrer l'essai gratuit de 3 jours.
            </span>
            <Badge tone="info" className="w-fit">
              Carte bancaire demandée à l'étape suivante, via Stripe
            </Badge>
          </span>
        ) : (
          "Créez votre compte, puis choisissez Plus, Pro, Max ou Business pour démarrer votre essai gratuit de 3 jours."
        )
      }
      footer={
        <>
          Déjà inscrit ?{" "}
          <Link href="/connexion" className="font-medium text-blue underline-offset-4 hover:underline">
            Se connecter
          </Link>
        </>
      }
    >
      <SignUpForm formule={plan?.id} />
    </AuthCard>
  );
}
