/**
 * Quota de recherches sur Internet calculé sur la période réellement facturée.
 *
 * La valeur affichée de chaque formule (Plus 90, Pro 600, Max 1 200, Business 600) correspond à un mois de
 * 30 jours : sujets × recherches par jour × 30. Le plafond appliqué suit le nombre réel de jours de la
 * période d'abonnement en cours (date de renouvellement Stripe), pour qu'un abonné qui utilise tous ses
 * sujets chaque jour ne soit jamais bloqué avant la fin du mois :
 *   28 jours → 84 / 560 / 1 120 / 560 ; 29 → 87 / 580 / 1 160 / 580 ; 30 → 90 / 600 / 1 200 / 600 ;
 *   31 jours → 93 / 620 / 1 240 / 620.
 *
 * Changement de formule en cours de période : Stripe conserve la date de renouvellement (prorata), le
 * compteur de la période continue et le plafond de la nouvelle formule s'applique immédiatement (une
 * montée en gamme débloque aussitôt des recherches ; une baisse ne supprime pas les recherches déjà faites,
 * mais aucune nouvelle recherche n'est faite au-delà du nouveau plafond). Une nouvelle période (renouvellement
 * ou fin d'essai) ouvre un nouveau compteur.
 * Essai : plafond propre à l'essai (2 recherches par jour), sans proratisation.
 */
import type { Entitlements } from "./entitlements";

export const REFERENCE_MONTH_DAYS = 30;
const DAY_MS = 86_400_000;

export interface SearchQuotaWindow {
  /** Clé du compteur (usage_counters.period) : « bp:AAAA-MM-JJ » (période facturée) ou « AAAA-MM » (mois civil). */
  period: string;
  start: Date;
  end: Date;
  days: number;
  /** Plafond de la période (null : pas de recherche possible). */
  limit: number;
  /** Plafond journalier (essai uniquement). */
  dailyLimit: number | null;
}

export interface BillingPeriod {
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
}

export function daysInUtcMonth(d: Date): number {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
}

/** Plafond pour une période de `days` jours à partir de la valeur de référence (30 jours). */
export function scaledMonthlyLimit(referenceMonthly: number, days: number): number {
  return Math.round((referenceMonthly * days) / REFERENCE_MONTH_DAYS);
}

export function searchQuotaWindow(ent: Pick<Entitlements, "source" | "monthlySearchCalls" | "dailySearchCalls">, period: BillingPeriod | null, now: Date = new Date()): SearchQuotaWindow {
  const start = period?.currentPeriodStart ?? null;
  const end = period?.currentPeriodEnd ?? null;
  const usable = start && end && start.getTime() <= now.getTime() && now.getTime() < end.getTime() && end.getTime() - start.getTime() >= DAY_MS;
  let window: { period: string; start: Date; end: Date; days: number };
  if (usable) {
    // Période mensuelle Stripe : 28 à 31 jours (bornée par prudence si les dates sont inhabituelles).
    const days = Math.min(31, Math.max(1, Math.round((end!.getTime() - start!.getTime()) / DAY_MS)));
    window = { period: `bp:${start!.toISOString().slice(0, 10)}`, start: start!, end: end!, days };
  } else {
    const s = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const e = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    window = { period: now.toISOString().slice(0, 7), start: s, end: e, days: daysInUtcMonth(now) };
  }
  if (ent.source === "trial") {
    return { ...window, limit: ent.monthlySearchCalls, dailyLimit: ent.dailySearchCalls };
  }
  if (ent.source === "none") return { ...window, limit: 0, dailyLimit: 0 };
  // Abonnement actif ou période de grâce : plafond proportionnel au nombre de jours de la période.
  return { ...window, limit: scaledMonthlyLimit(ent.monthlySearchCalls, Math.min(window.days, 31)), dailyLimit: ent.dailySearchCalls };
}
