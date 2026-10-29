import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Callout, Card, CardContent, PageHeader } from "@watchly/ui";
import { formatDateTime } from "@watchly/types";
import { requireUser } from "@/lib/auth";
import { getSubscriptionView } from "@/lib/data/account";
import { CancelButton } from "./cancel-button";

export const metadata: Metadata = { title: "Résilier" };

export default async function ResilierPage() {
  const user = await requireUser("/app/abonnement/resilier");
  const sub = await getSubscriptionView(user.id);
  if (!sub.subscriptionId) redirect("/app/abonnement");
  const end = sub.isTrial ? sub.trialEndsAt : sub.currentPeriodEnd;
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <PageHeader title="Résilier mon abonnement" />
      <Card>
        <CardContent className="flex flex-col gap-4 pt-6 text-[15px] leading-relaxed">
          {sub.isTrial ? (
            <p>
              Vous êtes en période d'essai jusqu'au <strong>{formatDateTime(end)}</strong>. En résiliant maintenant,{" "}
              <strong>aucun prélèvement ne sera effectué</strong> et vous conservez l'accès jusqu'à la fin de l'essai.
            </p>
          ) : (
            <p>
              Votre abonnement {sub.planName} restera actif jusqu'au <strong>{formatDateTime(end)}</strong>, puis ne sera pas
              renouvelé. Aucun remboursement au prorata n'est effectué pour la période en cours.
            </p>
          )}
          <p className="text-muted-fg">
            Ensuite, votre compte repassera en formule Découverte : les surveillances au-delà de 3 seront mises en pause, sans
            être supprimées. Vous pourrez revenir à tout moment.
          </p>
          {sub.cancelAtPeriodEnd ? <Callout tone="info">La résiliation est déjà enregistrée.</Callout> : <CancelButton />}
        </CardContent>
      </Card>
    </div>
  );
}
