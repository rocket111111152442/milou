import { Check, Minus } from "lucide-react";
import { PAID_PLAN_IDS, PLAN_CATALOG, type PlanId } from "@waverti/billing/catalog";
import { formatCents, formatInterval } from "@waverti/types";
import { cn } from "@waverti/ui";

const ROWS: Array<{ label: string; value: (id: PlanId) => string | boolean }> = [
  { label: "Prix par mois (TTC)", value: (id) => formatCents(PLAN_CATALOG[id].priceCents) },
  { label: "Surveillances de pages", value: (id) => String(PLAN_CATALOG[id].maxMonitors) },
  { label: "Sujets suivis sur Internet", value: (id) => String(PLAN_CATALOG[id].maxWebTopics) },
  { label: "Vérification des pages", value: (id) => `toutes les ${formatInterval(PLAN_CATALOG[id].pageIntervalMinutes).replace(/^toutes les /, "")}` },
  { label: "Historique conservé", value: (id) => `${PLAN_CATALOG[id].historyDays} jours` },
  { label: "Alertes par e-mail (par mois)", value: (id) => String(PLAN_CATALOG[id].monthlyEmailAlerts) },
  { label: "Sites professionnels (Business)", value: (id) => (PLAN_CATALOG[id].businessSitesIncluded > 0 ? String(PLAN_CATALOG[id].businessSitesIncluded) : false) },
  { label: "Alertes prioritaires", value: (id) => PLAN_CATALOG[id].priorityAlerts },
];

/** Comparatif des formules, construit à partir du catalogue (mêmes valeurs que les quotas appliqués). */
export function PlanCompare({ currentPlanId }: { currentPlanId?: string | null }) {
  return (
    <div role="region" aria-label="Comparatif des formules, défilement horizontal possible" tabIndex={0} className="card-glass overflow-x-auto rounded-2xl shadow-[var(--shadow-card)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue">
      <table className="w-full min-w-[640px] border-collapse text-sm" aria-label="Comparatif détaillé des formules">
        <thead>
          <tr>
            <th scope="col" className="sticky left-0 bg-white/80 px-4 py-4 text-left font-medium text-ink-soft backdrop-blur">
              Ce qui est inclus
            </th>
            {PAID_PLAN_IDS.map((id) => (
              <th key={id} scope="col" className={cn("px-4 py-4 text-left font-display text-base font-bold", currentPlanId === id && "bg-tint-blue")}>
                {PLAN_CATALOG[id].name}
                {currentPlanId === id ? <span className="ml-2 rounded-full bg-blue px-2 py-0.5 align-middle text-[10px] font-semibold uppercase text-white">Actuelle</span> : null}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ROWS.map((r) => (
            <tr key={r.label} className="border-t border-line/70">
              <th scope="row" className="sticky left-0 bg-white/80 px-4 py-3 text-left font-medium backdrop-blur">
                {r.label}
              </th>
              {PAID_PLAN_IDS.map((id) => {
                const v = r.value(id);
                return (
                  <td key={id} className={cn("px-4 py-3 tabular-nums", currentPlanId === id && "bg-tint-blue/60")}>
                    {v === true ? (
                      <>
                        <Check className="size-4 text-success" aria-hidden="true" />
                        <span className="sr-only">Inclus</span>
                      </>
                    ) : v === false ? (
                      <>
                        <Minus className="size-4 text-ink-soft" aria-hidden="true" />
                        <span className="sr-only">Non inclus</span>
                      </>
                    ) : (
                      v
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
