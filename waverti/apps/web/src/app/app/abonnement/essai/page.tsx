import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Callout, Card, CardContent, PageHeader } from "@waverti/ui";
import { isPaidPlanId, PLAN_FEATURES } from "@waverti/billing/catalog";
import { previewCheckout } from "@waverti/billing";
import { formatCents, formatDateTime } from "@waverti/types";
import { requireUser } from "@/lib/auth";
import { getSubscriptionView } from "@/lib/data/account";
import { getDb } from "@/lib/db";
import { isBillingConfigured } from "@/lib/stripe";
import { TrialConfirm } from "./trial-confirm";

export const metadata: Metadata = { title: "Confirmer votre formule" };

export default async function EssaiPage({ searchParams }: { searchParams: Promise<{ formule?: string }> }) {
  const user = await requireUser("/app/abonnement");
  const { formule } = await searchParams;
  if (!isPaidPlanId(formule)) redirect("/app/abonnement");
  const sub = await getSubscriptionView(user.id);
  if (sub.subscriptionId) redirect("/app/abonnement");
  if (!isBillingConfigured()) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Souscription indisponible" />
        <Callout tone="warning">Stripe n'est pas configuré sur cet environnement : aucune souscription n'est possible ici.</Callout>
      </div>
    );
  }
  const preview = await previewCheckout(getDb(), user, formule, new Date(), process.env.WAVERTI_HASH_PEPPER);
  const rows: Array<[string, string]> = [
    ["Formule", `${preview.planName}`],
    ["Prix après l'essai", `${formatCents(preview.priceCents)} TTC par mois`],
    ["Durée de l'essai", preview.trial ? "3 jours (72 heures), gratuit" : "Pas d'essai (déjà utilisé)"],
    ["Premier prélèvement", preview.trial ? formatDateTime(preview.firstChargeAt, user.timezone) : "Immédiatement, à la validation"],
    ["Renouvellement", "Chaque mois à la même date, sans engagement"],
    ["Résiliation", "En ligne depuis la page Abonnement, à tout moment (avant la fin de l'essai : aucun prélèvement)"],
  ];
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <PageHeader
        title={preview.trial ? `Démarrer l'essai ${preview.planName}` : `Souscrire à ${preview.planName}`}
        description="Vérifiez les conditions avant de passer au paiement sécurisé Stripe."
      />
      {!preview.trial ? (
        <Callout tone="warning" title="Essai gratuit déjà utilisé">
          Un seul essai est possible par personne. Vous pouvez souscrire directement : le premier paiement aura lieu à la validation.
        </Callout>
      ) : null}
      <Card>
        <CardContent className="pt-6">
          <dl className="divide-y divide-line">
            {rows.map(([k, v]) => (
              <div key={k} className="flex flex-col gap-0.5 py-3 sm:flex-row sm:justify-between sm:gap-6">
                <dt className="text-sm text-muted-fg">{k}</dt>
                <dd className="text-sm font-medium sm:text-right">{v}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>
      {preview.trial ? (
        <Callout tone="info" title="Pendant l'essai">
          Limites de l'essai : 3 surveillances actives, 1 sujet de recherche sur Internet vérifié une fois par jour, 10 alertes
          par e-mail
          {preview.planId === "business" ? ", un site professionnel vérifié" : ""}. Les quotas complets s'activent après le premier
          paiement réussi. Un rappel vous est envoyé par e-mail environ 24 heures avant le prélèvement. Désinstaller
          l'application ne résilie pas l'abonnement.
        </Callout>
      ) : null}
      <Card>
        <CardContent className="pt-6">
          <p className="mb-3 text-sm font-semibold">Inclus dans {preview.planName}</p>
          <ul className="grid gap-2 text-sm text-ink-soft sm:grid-cols-2">
            {PLAN_FEATURES[preview.planId].map((f) => (
              <li key={f}>• {f}</li>
            ))}
          </ul>
        </CardContent>
      </Card>
      <TrialConfirm planId={preview.planId} trial={preview.trial} />
      <p className="text-center text-xs text-muted-fg">
        Paiement traité par Stripe. Waverti ne voit ni ne stocke votre numéro de carte.{" "}
        <Link href="/legal/conditions-generales" className="underline">
          Conditions générales
        </Link>
      </p>
    </div>
  );
}
