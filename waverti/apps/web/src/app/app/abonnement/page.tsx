import type { Metadata } from "next";
import Link from "next/link";
import { CalendarClock, CreditCard } from "lucide-react";
import { Badge, Button, Callout, Card, CardContent, CardHeader, CardTitle, PageHeader, Progress } from "@waverti/ui";
import { PAID_PLAN_IDS, PLAN_CATALOG } from "@waverti/billing/catalog";
import { checkTrialEligibility, resolveCheckoutReturn, type CheckoutReturnState } from "@waverti/billing";
import { formatCents, formatDateTime } from "@waverti/types";
import { requireUser } from "@/lib/auth";
import { getQuotaViews, getSubscriptionView, loadEntitlements } from "@/lib/data/account";
import { getDb } from "@/lib/db";
import { getStripe, isBillingConfigured } from "@/lib/stripe";
import { ConfirmingCallout } from "./checkout-return";
import { PlanActions, PortalButton } from "./plan-actions";

export const metadata: Metadata = { title: "Abonnement" };

const STATUS: Record<string, { label: string; tone: "success" | "info" | "warning" | "danger" | "neutral" }> = {
  trialing: { label: "Essai en cours", tone: "info" },
  active: { label: "Actif", tone: "success" },
  past_due: { label: "Paiement en attente", tone: "warning" },
  unpaid: { label: "Impayé", tone: "danger" },
};

export default async function AbonnementPage({ searchParams }: { searchParams: Promise<{ checkout?: string; bienvenue?: string; session_id?: string }> }) {
  const user = await requireUser("/app/abonnement");
  const { checkout, bienvenue, session_id: sessionId } = await searchParams;
  const [sub, ent] = await Promise.all([getSubscriptionView(user.id), loadEntitlements(user.id)]);
  const quotas = await getQuotaViews(user.id, ent);
  const billing = isBillingConfigured();
  // Retour de Checkout : message déterminé par la session Stripe vérifiée côté serveur, jamais par l'URL seule.
  let returned: CheckoutReturnState | null = null;
  if (checkout === "success" && billing) {
    returned = await resolveCheckoutReturn(getDb(), getStripe(), user.id, sessionId).catch(() => ({ kind: "unverified" }) as CheckoutReturnState);
  }
  const confirming = returned?.kind === "confirming";
  // Éligibilité réelle à l'essai : les boutons ne promettent « 3 jours » que si l'essai est effectivement possible.
  const trialEligible = billing && !sub.subscriptionId ? (await checkTrialEligibility(getDb(), user.id, user.email, process.env.WAVERTI_HASH_PEPPER)).eligible : false;
  const status = sub.status ? STATUS[sub.status] : null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Abonnement" description="Votre formule, vos quotas et votre facturation." />
      {bienvenue && !sub.planId ? (
        <Callout tone="info" title="Bienvenue sur Waverti">
          Choisissez la formule qui vous convient : vous l'essayez gratuitement pendant 3 jours et vous pouvez résilier en ligne
          avant la fin de l'essai, sans aucun prélèvement.
        </Callout>
      ) : null}
      {returned ? <CheckoutReturnBanner state={returned} /> : null}
      {checkout === "canceled" ? (
        <Callout tone="neutral" role="status">
          Paiement abandonné : aucun abonnement n'a été créé.
        </Callout>
      ) : null}
      {!billing ? (
        <Callout tone="warning" title="Paiement indisponible sur cet environnement">
          Stripe n'est pas configuré ici. Les formules payantes ne peuvent pas être souscrites ; aucune donnée bancaire n'est collectée.
        </Callout>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <Card>
          <CardHeader className="flex-row items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
              <CardTitle as="h2">{sub.planName ? `Formule ${sub.planName}` : "Aucun abonnement en cours"}</CardTitle>
              <p className="text-sm text-muted-fg">
                {sub.betaEndsAt
                  ? "Accès bêta privé sans paiement, avec des quotas réduits. Aucun moyen de paiement n'est enregistré."
                  : sub.planId
                  ? `${formatCents(PLAN_CATALOG[sub.planId as keyof typeof PLAN_CATALOG]?.priceCents ?? 0)} / mois TTC, renouvelé chaque mois jusqu'à résiliation`
                  : trialEligible
                  ? "Vos surveillances sont en pause. Choisissez une formule : essai gratuit de 3 jours, sans prélèvement pendant l'essai."
                  : "Vos surveillances sont en pause. Choisissez une formule : votre essai gratuit a déjà été utilisé, le premier paiement a lieu à la validation."}
              </p>
            </div>
            {sub.betaEndsAt ? (
              <Badge tone="info">Bêta privée</Badge>
            ) : status ? (
              <Badge tone={status.tone}>{status.label}</Badge>
            ) : (
              <Badge tone="neutral">Inactif</Badge>
            )}
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {sub.betaEndsAt ? (
              <p className="flex items-start gap-2 text-sm" data-testid="beta-access">
                <CalendarClock className="mt-0.5 size-4 shrink-0 text-blue" aria-hidden="true" />
                <span>
                  Accès bêta jusqu'au <strong>{formatDateTime(sub.betaEndsAt)}</strong>. Il s'arrête automatiquement à cette date ;
                  vos surveillances seront alors mises en pause, sauf si vous choisissez une formule.
                </span>
              </p>
            ) : null}
            {sub.isTrial && sub.trialEndsAt ? (
              <p className="flex items-start gap-2 text-sm">
                <CalendarClock className="mt-0.5 size-4 shrink-0 text-blue" aria-hidden="true" />
                <span>
                  Essai jusqu'au <strong>{formatDateTime(sub.trialEndsAt)}</strong>.{" "}
                  {sub.cancelAtPeriodEnd ? "Résiliation enregistrée : aucun prélèvement ne sera effectué." : "Premier prélèvement à cette date, sauf résiliation."}
                </span>
              </p>
            ) : null}
            {!sub.isTrial && sub.currentPeriodEnd ? (
              <p className="flex items-start gap-2 text-sm">
                <CalendarClock className="mt-0.5 size-4 shrink-0 text-blue" aria-hidden="true" />
                <span>
                  {sub.cancelAtPeriodEnd ? "Se termine le" : "Prochain renouvellement le"} <strong>{formatDateTime(sub.currentPeriodEnd)}</strong>.
                </span>
              </p>
            ) : null}
            {sub.status === "past_due" ? (
              <Callout tone="warning">Le dernier paiement a échoué. Mettez à jour votre carte pour conserver vos fonctionnalités.</Callout>
            ) : null}
            {sub.subscriptionId ? (
              <p className="text-xs text-muted-fg">
                Désinstaller l'application ou supprimer vos surveillances ne résilie pas l'abonnement : utilisez le bouton
                « Résilier » ci-dessous.
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              {sub.subscriptionId ? (
                <>
                  {billing ? <PortalButton /> : null}
                  {!sub.cancelAtPeriodEnd ? (
                    <Button asChild variant="secondary">
                      <Link href="/app/abonnement/resilier">Résilier</Link>
                    </Button>
                  ) : billing ? (
                    <PlanActions mode="resume" />
                  ) : null}
                </>
              ) : null}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle as="h2">Quotas utilisés</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {quotas.map((q) => (
              <Progress key={q.key} label={q.label} value={q.used} max={q.limit} />
            ))}
            <p className="text-xs text-muted-fg">
              {ent.pageIntervalMinutes > 0
                ? `Fréquence minimale : pages toutes les ${ent.pageIntervalMinutes >= 60 ? `${ent.pageIntervalMinutes / 60} h` : `${ent.pageIntervalMinutes} min`}.`
                : "Aucune vérification sans abonnement ni essai."}
              {ent.cloudRelay ? " Surveillance continue par nos serveurs incluse." : ""}
            </p>
          </CardContent>
        </Card>
      </div>


      <section id="formules" aria-labelledby="change-title" className="flex scroll-mt-24 flex-col gap-4">
        <h2 id="change-title" className="font-display text-lg font-semibold">
          {sub.subscriptionId ? "Changer de formule" : trialEligible ? "Choisir une formule — 3 jours d'essai gratuit" : "Choisir une formule"}
        </h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {PAID_PLAN_IDS.map((id) => {
            const p = PLAN_CATALOG[id];
            const current = sub.planId === id && sub.subscriptionId;
            return (
              <Card key={id} className={current ? "border-gradient" : undefined}>
                <CardContent className="flex h-full flex-col gap-3 pt-6">
                  <div className="flex items-baseline justify-between">
                    <p className="font-display text-lg font-bold">{p.name}</p>
                    <p className="font-display font-semibold tabular-nums">{formatCents(p.priceCents)}</p>
                  </div>
                  <p className="text-sm text-muted-fg">{p.description}</p>
                  <div className="mt-auto pt-2">
                    {current ? (
                      <Badge tone="gradient">Formule actuelle</Badge>
                    ) : !billing ? (
                      <Button variant="secondary" disabled className="w-full">
                        Indisponible ici
                      </Button>
                    ) : sub.subscriptionId ? (
                      <PlanActions mode="change" planId={id} planName={p.name} />
                    ) : confirming ? (
                      <Button variant="secondary" disabled className="w-full">
                        Confirmation en cours
                      </Button>
                    ) : (
                      <Button asChild className="w-full">
                        <Link href={`/app/abonnement/essai?formule=${id}`}>
                          <CreditCard aria-hidden="true" /> {trialEligible ? `Essayer ${p.name} 3 jours` : `Souscrire à ${p.name}`}
                        </Link>
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
        <p className="text-xs text-muted-fg">
          Les changements de formule sont proratisés par Stripe : la différence est créditée ou facturée sur la prochaine facture.
          En cas de baisse de quotas, les surveillances excédentaires sont mises en pause, jamais supprimées.
        </p>
      </section>
    </div>
  );
}

function CheckoutReturnBanner({ state }: { state: CheckoutReturnState }) {
  switch (state.kind) {
    case "confirming":
      return <ConfirmingCallout />;
    case "confirmed":
      return (
        <Callout tone="success" title={state.status === "trialing" ? "Essai démarré" : "Abonnement confirmé"} role="status">
          {state.status === "trialing"
            ? "Votre essai gratuit est actif. Aucun prélèvement n'est effectué pendant l'essai."
            : "Votre abonnement est actif."}
        </Callout>
      );
    case "trial_refused":
      return (
        <Callout tone="warning" title="Essai annulé : essai gratuit déjà utilisé" role="status">
          {state.noCharge
            ? "Un essai gratuit a déjà été utilisé avec cette adresse ou ce moyen de paiement. Aucun prélèvement effectué. Vous pouvez souscrire sans essai (premier paiement à la validation)."
            : "Un essai gratuit a déjà été utilisé avec cette adresse ou ce moyen de paiement et l'abonnement d'essai a été annulé. Vérifiez vos paiements dans le portail de facturation."}
        </Callout>
      );
    case "ended":
      return (
        <Callout tone="neutral" role="status">
          Cet abonnement est terminé.
        </Callout>
      );
    case "incomplete":
      return (
        <Callout tone="neutral" role="status">
          Paiement non terminé : aucun abonnement n'a été créé.
        </Callout>
      );
    default:
      return (
        <Callout tone="neutral" title="Retour de paiement non vérifié" role="status">
          Nous n'avons pas pu rattacher ce retour à votre compte. Votre abonnement ci-dessous reflète l'état réel de votre compte.
        </Callout>
      );
  }
}
