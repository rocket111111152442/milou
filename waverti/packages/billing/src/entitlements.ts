/**
 * Calcul des droits effectifs d'un utilisateur. Fonction PURE (testée unitairement) :
 * l'état d'abonnement Stripe (synchronisé par webhooks signés) + la formule (table plans)
 * déterminent les quotas. Le client (navigateur, desktop) ne peut jamais influencer ce calcul.
 */
import type { SubscriptionStatus } from "@waverti/database/schema";

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
  monthlyEmailAlerts: number;
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
  trialEmailAlerts: number;
}

export interface SubscriptionSnapshot {
  planId: string;
  status: SubscriptionStatus;
  extraSites: number;
  trialEnd: Date | null;
  currentPeriodEnd: Date | null;
}

export interface Entitlements {
  /** null : aucun abonnement valide (il n'existe plus de formule gratuite). */
  planId: string | null;
  source: "none" | "trial" | "subscription" | "grace" | "admin_grant";
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
  /** Alertes envoyées par e-mail ce mois-ci (les alertes dans l'application ne sont pas limitées). */
  monthlyEmailAlerts: number;
  businessSites: number;
  businessEndpointsPerSite: number;
  businessHttpIntervalSeconds: number;
  businessScenariosPerSite: number;
  /** Scénarios navigateur pour tout le compte : ceux des sites inclus (les sites supplémentaires n'en apportent pas). */
  businessScenarios: number;
  businessScenarioIntervalMinutes: number;
  businessTlsChecks: boolean;
  priorityAlerts: boolean;
  validUntil: Date | null;
}

/** Pendant l'essai : recherche sur Internet au plus une fois par jour et par sujet. */
export const TRIAL_MIN_WEB_INTERVAL_MINUTES = 1440;

/** Délai de grâce après un échec de paiement (past_due) avant la suspension des surveillances. */
export const PAST_DUE_GRACE_DAYS = 7;
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
    monthlyEmailAlerts: plan.monthlyEmailAlerts,
    businessSites: plan.businessSitesIncluded,
    businessEndpointsPerSite: plan.businessEndpointsPerSite,
    businessHttpIntervalSeconds: plan.businessHttpIntervalSeconds,
    businessScenariosPerSite: plan.businessScenariosPerSite,
    businessScenarios: plan.businessScenariosPerSite * plan.businessSitesIncluded,
    businessScenarioIntervalMinutes: plan.businessScenarioIntervalMinutes,
    businessTlsChecks: plan.businessTlsChecks,
    priorityAlerts: plan.priorityAlerts,
  };
}

/**
 * Droits d'un compte sans abonnement valide : aucun. Les données restent consultables (historique),
 * mais aucune surveillance n'est exécutée, ni sur l'ordinateur ni sur les serveurs.
 */
export function noEntitlements(subscriptionStatus: SubscriptionStatus | null = null): Entitlements {
  return {
    planId: null,
    source: "none",
    subscriptionStatus,
    validUntil: null,
    maxMonitors: 0,
    maxWebTopics: 0,
    pageIntervalMinutes: 0,
    webIntervalMinutes: null,
    cloudRelay: false,
    emailAlerts: false,
    historyDays: 30,
    advancedHistory: false,
    dataExports: false,
    monthlySearchCalls: 0,
    dailySearchCalls: 0,
    monthlyEmailAlerts: 0,
    businessSites: 0,
    businessEndpointsPerSite: 0,
    businessHttpIntervalSeconds: 60,
    businessScenariosPerSite: 0,
    businessScenarios: 0,
    businessScenarioIntervalMinutes: 120,
    businessTlsChecks: false,
    priorityAlerts: false,
  };
}

export function computeEntitlements(
  plans: ReadonlyMap<string, PlanRow>,
  subscription: SubscriptionSnapshot | null,
  now: Date = new Date(),
): Entitlements {
  if (!subscription) return noEntitlements();
  const none = noEntitlements(subscription.status);
  const plan = plans.get(subscription.planId);
  if (!plan) return none;

  switch (subscription.status) {
    case "trialing": {
      const trialLimit = subscription.trialEnd ? new Date(subscription.trialEnd.getTime() + WEBHOOK_LAG_MS) : null;
      if (trialLimit && trialLimit.getTime() <= now.getTime()) {
        // Essai terminé depuis longtemps sans confirmation de Stripe : prudence, aucun droit.
        return none;
      }
      const base = fromPlan(plan);
      return {
        ...base,
        planId: plan.id,
        source: "trial",
        subscriptionStatus: "trialing",
        maxMonitors: Math.min(plan.maxMonitors, plan.trialMaxMonitors),
        maxWebTopics: Math.min(plan.maxWebTopics, plan.trialMaxWebTopics),
        webIntervalMinutes: base.webIntervalMinutes === null ? null : Math.max(base.webIntervalMinutes, TRIAL_MIN_WEB_INTERVAL_MINUTES),
        businessSites: Math.min(plan.businessSitesIncluded, plan.trialMaxBusinessSites),
        businessScenarios: Math.min(base.businessScenarios, plan.trialMaxBusinessSites * plan.businessScenariosPerSite),
        dailySearchCalls: plan.trialDailySearchCalls,
        monthlySearchCalls: Math.min(plan.monthlySearchCalls, plan.trialDailySearchCalls * 3),
        monthlyEmailAlerts: Math.min(plan.monthlyEmailAlerts, plan.trialEmailAlerts),
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
      return none;
    }
    default:
      // canceled, unpaid, incomplete, incomplete_expired, paused : aucun droit.
      return none;
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
