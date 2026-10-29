import type { Metadata } from "next";
import Link from "next/link";
import { CalendarClock, CreditCard } from "lucide-react";
import { Badge, Button, Callout, Card, CardContent, CardHeader, CardTitle, PageHeader, Progress } from "@watchly/ui";
import { PLAN_CATALOG, EXTRA_SITE_ADDON } from "@watchly/billing/catalog";
import { formatCents, formatDateTime } from "@watchly/types";
import { requireUser } from "@/lib/auth";
import { getQuotaViews, getSubscriptionView, loadEntitlements } from "@/lib/data/account";
import { isBillingConfigured } from "@/lib/stripe";
import { PlanActions, PortalButton, ExtraSitesControl } from "./plan-actions";

export const metadata: Metadata = { title: "Abonnement" };

const STATUS: Record<string, { label: string; tone: "success" | "info" | "warning" | "danger" | "neutral" }> = {
  trialing: { label: "Essai en cours", tone: "info" },
  active: { label: "Actif", tone: "success" },
  past_due: { label: "Paiement en attente", tone: "warning" },
  unpaid: { label: "Impayé", tone: "danger" },
};

export default async function AbonnementPage({ searchParams }: { searchParams: Promise<{ checkout?: string }> }) {
  const user = await requireUser("/app/abonnement");
  const { checkout } = await searchParams;
  const [sub, ent] = await Promise.all([getSubscriptionView(user.id), loadEntitlements(user.id)]);
  const quotas = await getQuotaViews(user.id, ent);
  const billing = isBillingConfigured();
  const status = sub.status ? STATUS[sub.status] : null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Abonnement" description="Votre formule, vos quotas et votre facturation." />
      {checkout === "success" ? (
        <Callout tone="success" title="Paiement enregistré par Stripe" role="status">
          La confirmation de Stripe peut prendre quelques secondes. Votre formule se met à jour automatiquement dès réception.
        </Callout>
      ) : checkout === "canceled" ? (
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
              <CardTitle as="h2">Formule {sub.planName}</CardTitle>
              <p className="text-sm text-muted-fg">
                {sub.planId === "discovery"
                  ? "Gratuit · surveillances locales uniquement"
                  : `${formatCents(PLAN_CATALOG[sub.planId as keyof typeof PLAN_CATALOG]?.priceCents ?? 0)} / mois TTC`}
              </p>
            </div>
            {status ? <Badge tone={status.tone}>{status.label}</Badge> : <Badge tone="neutral">Gratuit</Badge>}
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
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
              Fréquence minimale : pages toutes les {ent.pageIntervalMinutes >= 60 ? `${ent.pageIntervalMinutes / 60} h` : `${ent.pageIntervalMinutes} min`}.
              {ent.cloudRelay ? " Relais cloud inclus." : " Sans relais cloud."}
            </p>
          </CardContent>
        </Card>
      </div>

      {sub.planId === "business" && !sub.isTrial && billing ? (
        <Card>
          <CardHeader>
            <CardTitle as="h2">Sites professionnels supplémentaires</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm text-muted-fg">
              {formatCents(EXTRA_SITE_ADDON.priceCents)} / mois par site, avec ses propres quotas (3 points de contrôle, 1 scénario). Le
              changement est proratisé.
            </p>
            <ExtraSitesControl current={Math.max(0, ent.businessSites - 1)} />
          </CardContent>
        </Card>
      ) : null}

      <section aria-labelledby="change-title" className="flex flex-col gap-4">
        <h2 id="change-title" className="font-display text-lg font-semibold">
          {sub.subscriptionId ? "Changer de formule" : "Passer à une formule payante"}
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          {(["plus", "pro", "business"] as const).map((id) => {
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
                    ) : (
                      <Button asChild className="w-full">
                        <Link href={`/app/abonnement/essai?formule=${id}`}>
                          <CreditCard aria-hidden="true" /> Choisir {p.name}
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
