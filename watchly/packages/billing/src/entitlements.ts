/**
 * Calcul des droits effectifs d'un utilisateur. Fonction PURE (testée unitairement) :
 * l'état d'abonnement Stripe (synchronisé par webhooks signés) + la formule (table plans)
 * déterminent les quotas. Le client (navigateur, desktop) ne peut jamais influencer ce calcul.
 */
import type { SubscriptionStatus } from "@watchly/database/schema";

export interface PlanRow {
  id: string;
  maxMonitors: number;
  maxWebTopics: number;
  pageIntervalMinutes: number;
  webIntervalMinutes: number | null;
  cloudRelay: boolean;
  emailAlerts: boolean;
  historyDays: number;
  advancedHistory: boolean;
  dataExports: boolean;
  monthlySearchCalls: number;
  businessSitesIncluded: number;
  businessEndpointsPerSite: number;
  businessHttpIntervalSeconds: number;
  businessScenariosPerSite: number;
  businessScenarioIntervalMinutes: number;
  businessTlsChecks: boolean;
  priorityAlerts: boolean;
  trialMaxMonitors: number;
  trialMaxWebTopics: number;
  trialMaxBusinessSites: number;
  trialDailySearchCalls: number;
}

export interface SubscriptionSnapshot {
  planId: string;
  status: SubscriptionStatus;
  extraSites: number;
  trialEnd: Date | null;
  currentPeriodEnd: Date | null;
}

export interface Entitlements {
  planId: string;
  source: "free" | "trial" | "subscription" | "grace" | "admin_grant";
  subscriptionStatus: SubscriptionStatus | null;
  maxMonitors: number;
  maxWebTopics: number;
  pageIntervalMinutes: number;
  webIntervalMinutes: number | null;
  cloudRelay: boolean;
  emailAlerts: boolean;
  historyDays: number;
  advancedHistory: boolean;
  dataExports: boolean;
  monthlySearchCalls: number;
  dailySearchCalls: number | null;
  businessSites: number;
  businessEndpointsPerSite: number;
  businessHttpIntervalSeconds: number;
  businessScenariosPerSite: number;
  businessScenarioIntervalMinutes: number;
  businessTlsChecks: boolean;
  priorityAlerts: boolean;
  validUntil: Date | null;
}

/** Délai de grâce après un échec de paiement (past_due) avant de repasser en Découverte. */
export const PAST_DUE_GRACE_DAYS = 7;
export const FREE_PLAN_ID = "discovery";
/** Marge laissée aux webhooks Stripe pour confirmer une conversion d'essai ou un renouvellement. */
export const WEBHOOK_LAG_MS = 2 * 3_600_000;

function fromPlan(plan: PlanRow): Omit<Entitlements, "planId" | "source" | "subscriptionStatus" | "validUntil"> {
  return {
    maxMonitors: plan.maxMonitors,
    maxWebTopics: plan.maxWebTopics,
    pageIntervalMinutes: plan.pageIntervalMinutes,
    webIntervalMinutes: plan.webIntervalMinutes,
    cloudRelay: plan.cloudRelay,
    emailAlerts: plan.emailAlerts,
    historyDays: plan.historyDays,
    advancedHistory: plan.advancedHistory,
    dataExports: plan.dataExports,
    monthlySearchCalls: plan.monthlySearchCalls,
    dailySearchCalls: null,
    businessSites: plan.businessSitesIncluded,
    businessEndpointsPerSite: plan.businessEndpointsPerSite,
    businessHttpIntervalSeconds: plan.businessHttpIntervalSeconds,
    businessScenariosPerSite: plan.businessScenariosPerSite,
    businessScenarioIntervalMinutes: plan.businessScenarioIntervalMinutes,
    businessTlsChecks: plan.businessTlsChecks,
    priorityAlerts: plan.priorityAlerts,
  };
}

export function computeEntitlements(
  plans: ReadonlyMap<string, PlanRow>,
  subscription: SubscriptionSnapshot | null,
  now: Date = new Date(),
): Entitlements {
  const free = plans.get(FREE_PLAN_ID);
  if (!free) throw new Error("La formule gratuite « discovery » est introuvable");
  const freeEntitlements: Entitlements = {
    planId: FREE_PLAN_ID,
    source: "free",
    subscriptionStatus: subscription?.status ?? null,
    validUntil: null,
    ...fromPlan(free),
  };
  if (!subscription) return { ...freeEntitlements, subscriptionStatus: null };
  const plan = plans.get(subscription.planId);
  if (!plan) return freeEntitlements;

  switch (subscription.status) {
    case "trialing": {
      const trialLimit = subscription.trialEnd ? new Date(subscription.trialEnd.getTime() + WEBHOOK_LAG_MS) : null;
      if (trialLimit && trialLimit.getTime() <= now.getTime()) {
        // Essai terminé depuis longtemps sans confirmation de Stripe : prudence, droits gratuits.
        return freeEntitlements;
      }
      const base = fromPlan(plan);
      return {
        ...base,
        planId: plan.id,
        source: "trial",
        subscriptionStatus: "trialing",
        maxMonitors: Math.min(plan.maxMonitors, plan.trialMaxMonitors),
        maxWebTopics: Math.min(plan.maxWebTopics, plan.trialMaxWebTopics),
        businessSites: Math.min(plan.businessSitesIncluded, plan.trialMaxBusinessSites),
        dailySearchCalls: plan.trialDailySearchCalls,
        monthlySearchCalls: Math.min(plan.monthlySearchCalls, plan.trialDailySearchCalls * 3),
        validUntil: trialLimit,
      };
    }
    case "active":
      return {
        ...fromPlan(plan),
        planId: plan.id,
        source: "subscription",
        subscriptionStatus: "active",
        businessSites: plan.businessSitesIncluded + (plan.businessSitesIncluded > 0 ? subscription.extraSites : 0),
        validUntil: subscription.currentPeriodEnd ? new Date(subscription.currentPeriodEnd.getTime() + WEBHOOK_LAG_MS) : null,
      };
    case "past_due": {
      const graceEnd = subscription.currentPeriodEnd
        ? new Date(subscription.currentPeriodEnd.getTime() + PAST_DUE_GRACE_DAYS * 86_400_000)
        : null;
      if (graceEnd && graceEnd.getTime() > now.getTime()) {
        return {
          ...fromPlan(plan),
          planId: plan.id,
          source: "grace",
          subscriptionStatus: "past_due",
          businessSites: plan.businessSitesIncluded + (plan.businessSitesIncluded > 0 ? subscription.extraSites : 0),
          validUntil: graceEnd,
        };
      }
      return freeEntitlements;
    }
    default:
      // canceled, unpaid, incomplete, incomplete_expired, paused : aucun droit payant.
      return freeEntitlements;
  }
}

/** Rôle applicatif dérivé de l'abonnement (le rôle admin n'est jamais attribué ni retiré ici). */
export function roleForEntitlements(current: "user" | "business" | "admin", e: Entitlements): "user" | "business" | "admin" {
  if (current === "admin") return "admin";
  return e.businessSites > 0 ? "business" : "user";
}

const LIVE_STATUSES: ReadonlySet<SubscriptionStatus> = new Set(["trialing", "active", "past_due", "unpaid"]);
export function isLiveStatus(s: SubscriptionStatus): boolean {
  return LIVE_STATUSES.has(s);
}
