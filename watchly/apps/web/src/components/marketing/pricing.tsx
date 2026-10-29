import Link from "next/link";
import { Check, Minus } from "lucide-react";
import { Badge, Button, Container, SectionHeading, cn } from "@watchly/ui";
import { EXTRA_SITE_ADDON, PLAN_FEATURES, type PlanDefinition, type PlanId } from "@watchly/billing/catalog";
import { formatCents, formatInterval } from "@watchly/types";

export function PricingCards({ plans }: { plans: PlanDefinition[] }) {
  return (
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
      {plans.map((p) => {
        const highlighted = p.id === "pro";
        return (
          <article
            key={p.id}
            id={p.id}
            aria-labelledby={`plan-${p.id}`}
            className={cn(
              "relative flex flex-col rounded-2xl bg-white p-7",
              highlighted ? "border-gradient shadow-lift" : "border border-line",
            )}
          >
            {highlighted ? (
              <Badge tone="gradient" className="absolute -top-3 left-7">
                Le plus complet pour les particuliers
              </Badge>
            ) : null}
            <h3 id={`plan-${p.id}`} className="font-display text-xl font-bold">
              {p.name}
            </h3>
            <p className="mt-2 min-h-12 text-sm text-muted-fg">{p.description}</p>
            <p className="mt-6 flex items-baseline gap-1.5">
              <span className="font-display text-4xl font-extrabold tracking-tight tabular-nums">
                {p.priceCents === 0 ? "0 €" : formatCents(p.priceCents)}
              </span>
              <span className="text-sm text-muted-fg">{p.priceCents === 0 ? "pour toujours" : "/ mois TTC"}</span>
            </p>
            <p className="mt-1 h-5 text-xs text-muted-fg">
              {p.trialHours ? "Essai gratuit de 72 h · carte bancaire requise" : "Aucune carte bancaire"}
            </p>
            <Button asChild className="mt-6" variant={highlighted ? "primary" : "secondary"}>
              <Link href={p.id === "discovery" ? "/inscription" : `/inscription?formule=${p.id}`}>
                {p.id === "discovery" ? "Commencer gratuitement" : `Essayer ${p.name} 72 h`}
              </Link>
            </Button>
            <ul className="mt-7 flex flex-col gap-3 border-t border-line pt-6 text-sm">
              {PLAN_FEATURES[p.id].map((f) => (
                <li key={f} className="flex gap-2.5">
                  <Check className="mt-0.5 size-4 shrink-0 text-blue" aria-hidden="true" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            {p.id === "business" ? (
              <p className="mt-6 rounded-xl bg-surface p-3 text-xs text-muted-fg">
                {EXTRA_SITE_ADDON.name} : {formatCents(EXTRA_SITE_ADDON.priceCents)} / mois, avec ses propres quotas de
                contrôle.
              </p>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}

type Row = { label: string; value: (p: PlanDefinition) => string | boolean };

const rows: Row[] = [
  { label: "Surveillances au total", value: (p) => String(p.maxMonitors) },
  { label: "Dont sujets de recherche sur Internet", value: (p) => (p.maxWebTopics ? String(p.maxWebTopics) : false) },
  { label: "Fréquence de vérification des pages", value: (p) => formatInterval(p.pageIntervalMinutes) },
  { label: "Recherche Web par sujet", value: (p) => (p.webIntervalMinutes ? formatInterval(p.webIntervalMinutes) : false) },
  { label: "Contrôles sur votre ordinateur", value: () => true },
  { label: "Relais par les serveurs Watchly", value: (p) => p.cloudRelay },
  { label: "Notifications dans l'application", value: () => true },
  { label: "Alertes par e-mail", value: (p) => p.emailAlerts },
  { label: "Historique", value: (p) => `${p.historyDays} jours${p.advancedHistory ? " (avancé)" : ""}` },
  { label: "Exports de données", value: (p) => p.dataExports },
  { label: "Sites professionnels inclus", value: (p) => (p.businessSitesIncluded ? String(p.businessSitesIncluded) : false) },
  { label: "Points de contrôle par site", value: (p) => (p.businessEndpointsPerSite ? String(p.businessEndpointsPerSite) : false) },
  { label: "Vérification HTTP à la minute", value: (p) => p.businessSitesIncluded > 0 },
  { label: "Scénario navigateur", value: (p) => (p.businessScenariosPerSite ? `${p.businessScenariosPerSite} toutes les 2 h` : false) },
  { label: "Vérification du certificat HTTPS", value: (p) => p.businessTlsChecks },
  { label: "Confirmation des pannes avant alerte", value: (p) => p.businessSitesIncluded > 0 },
  { label: "Alertes prioritaires", value: (p) => p.priorityAlerts },
  { label: "Essai gratuit", value: (p) => (p.trialHours ? "72 heures" : false) },
];

export function PricingComparison({ plans }: { plans: PlanDefinition[] }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-white">
      <table className="w-full min-w-[720px] border-collapse text-sm">
        <caption className="sr-only">Comparatif détaillé des formules Watchly</caption>
        <thead>
          <tr className="border-b border-line bg-surface">
            <th scope="col" className="w-1/3 px-5 py-4 text-left font-medium text-muted-fg">
              Fonctionnalité
            </th>
            {plans.map((p) => (
              <th key={p.id} scope="col" className="px-5 py-4 text-center font-display font-bold">
                {p.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="border-b border-line last:border-0">
              <th scope="row" className="px-5 py-3.5 text-left font-normal text-ink-soft">
                {r.label}
              </th>
              {plans.map((p) => {
                const v = r.value(p);
                return (
                  <td key={p.id} className="px-5 py-3.5 text-center">
                    {v === true ? (
                      <Check className="mx-auto size-4 text-blue" aria-label="Inclus" />
                    ) : v === false ? (
                      <Minus className="mx-auto size-4 text-muted" aria-label="Non inclus" />
                    ) : (
                      <span className="font-medium">{v}</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PricingSection({ plans, standalone = false }: { plans: PlanDefinition[]; standalone?: boolean }) {
  return (
    <section id="tarifs" aria-labelledby="pricing-title" className="border-y border-line bg-surface py-24 sm:py-32">
      <Container className="flex flex-col gap-14">
        <SectionHeading
          as={standalone ? "h1" : "h2"}
          id="pricing-title"
          eyebrow="Tarifs"
          title="Une formule pour chaque besoin"
          description="Commencez gratuitement. Passez à une formule payante quand vous voulez plus de surveillances, le relais cloud ou la surveillance de votre site professionnel."
        />
        <PricingCards plans={plans} />
        <div className="flex flex-col gap-4">
          <h2 className="font-display text-xl font-bold">Comparatif détaillé</h2>
          <PricingComparison plans={plans} />
          <p className="text-sm text-muted-fg">
            Prix TTC en euros, facturés chaque mois. Essai de 72 heures sur Plus, Pro et Business : la carte est enregistrée
            par Stripe et le premier prélèvement a lieu à la fin de l'essai, sauf résiliation avant cette date. Résiliation
            en ligne à tout moment, effective à la fin de la période en cours.
          </p>
        </div>
      </Container>
    </section>
  );
}

export function planOrder(plans: PlanDefinition[]): PlanDefinition[] {
  const order: PlanId[] = ["discovery", "plus", "pro", "business"];
  return [...plans].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
}
