/**
 * Catalogue d'affichage des formules. Les valeurs de référence pour l'application des quotas
 * sont celles de la table `plans` (paramétrable) ; ce catalogue sert de repli pour les pages
 * publiques quand la base n'est pas joignable et doit rester aligné avec la migration de seed
 * (vérifié par le test catalog.int.test.ts).
 */
/** Seules formules commercialisées : il n'existe plus de formule gratuite permanente. */
export type PlanId = "plus" | "pro" | "max" | "business";

export interface PlanLimits {
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
  /** Alertes envoyées par e-mail par mois (les alertes dans l'application et sur le bureau ne sont pas limitées). */
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

export interface PlanDefinition extends PlanLimits {
  id: PlanId;
  name: string;
  description: string;
  priceCents: number;
  trialHours: number;
  sortOrder: number;
  /** lookup_key du prix Stripe mensuel (le price_ réel est récupéré chez Stripe, jamais inventé). */
  stripeLookupKey: string;
}

/**
 * Recherches mensuelles = sujets × recherches par jour et par sujet × 30 : un abonné qui utilise 100 % de ses
 * sujets reste dans son plafond (Plus 3 × 1 × 30 = 90 ; Pro et Business 10 × 2 × 30 = 600 ; Max 20 × 2 × 30 = 1 200).
 */
export const PLAN_CATALOG: Record<PlanId, PlanDefinition> = {
  plus: {
    id: "plus",
    name: "Plus",
    description: "L'essentiel pour suivre vos pages et quelques sujets sur Internet.",
    priceCents: 599,
    trialHours: 72,
    sortOrder: 20,
    stripeLookupKey: "waverti_plus_monthly",
    maxMonitors: 20,
    maxWebTopics: 3,
    pageIntervalMinutes: 360,
    webIntervalMinutes: 1440,
    cloudRelay: true,
    emailAlerts: true,
    historyDays: 90,
    advancedHistory: false,
    dataExports: false,
    monthlySearchCalls: 90,
    monthlyEmailAlerts: 30,
    businessSitesIncluded: 0,
    businessEndpointsPerSite: 0,
    businessHttpIntervalSeconds: 60,
    businessScenariosPerSite: 0,
    businessScenarioIntervalMinutes: 120,
    businessTlsChecks: false,
    priorityAlerts: false,
    trialMaxBusinessSites: 0,
    trialMaxMonitors: 3,
    trialMaxWebTopics: 1,
    trialDailySearchCalls: 2,
    trialEmailAlerts: 10,
  },
  pro: {
    id: "pro",
    name: "Pro",
    description: "Pour les usages réguliers : 100 surveillances, historique avancé et exports.",
    priceCents: 1499,
    trialHours: 72,
    sortOrder: 30,
    stripeLookupKey: "waverti_pro_monthly",
    maxMonitors: 100,
    maxWebTopics: 10,
    pageIntervalMinutes: 120,
    webIntervalMinutes: 720,
    cloudRelay: true,
    emailAlerts: true,
    historyDays: 365,
    advancedHistory: true,
    dataExports: true,
    monthlySearchCalls: 600,
    monthlyEmailAlerts: 80,
    businessSitesIncluded: 0,
    businessEndpointsPerSite: 0,
    businessHttpIntervalSeconds: 60,
    businessScenariosPerSite: 0,
    businessScenarioIntervalMinutes: 120,
    businessTlsChecks: false,
    priorityAlerts: false,
    trialMaxBusinessSites: 0,
    trialMaxMonitors: 3,
    trialMaxWebTopics: 1,
    trialDailySearchCalls: 2,
    trialEmailAlerts: 10,
  },
  max: {
    id: "max",
    name: "Max",
    description: "Pour les utilisateurs intensifs : 150 surveillances, 20 sujets, pages vérifiées chaque heure.",
    priceCents: 2999,
    trialHours: 72,
    sortOrder: 35,
    stripeLookupKey: "waverti_max_monthly",
    maxMonitors: 150,
    maxWebTopics: 20,
    pageIntervalMinutes: 60,
    webIntervalMinutes: 720,
    cloudRelay: true,
    emailAlerts: true,
    historyDays: 365,
    advancedHistory: true,
    dataExports: true,
    monthlySearchCalls: 1200,
    monthlyEmailAlerts: 150,
    businessSitesIncluded: 0,
    businessEndpointsPerSite: 0,
    businessHttpIntervalSeconds: 60,
    businessScenariosPerSite: 0,
    businessScenarioIntervalMinutes: 120,
    businessTlsChecks: false,
    priorityAlerts: false,
    trialMaxBusinessSites: 0,
    trialMaxMonitors: 3,
    trialMaxWebTopics: 1,
    trialDailySearchCalls: 2,
    trialEmailAlerts: 10,
  },
  business: {
    id: "business",
    name: "Business",
    description: "Toutes les fonctions Pro + la surveillance de votre site professionnel.",
    priceCents: 3999,
    trialHours: 72,
    sortOrder: 40,
    stripeLookupKey: "waverti_business_monthly",
    maxMonitors: 100,
    maxWebTopics: 10,
    pageIntervalMinutes: 120,
    webIntervalMinutes: 720,
    cloudRelay: true,
    emailAlerts: true,
    historyDays: 365,
    advancedHistory: true,
    dataExports: true,
    monthlySearchCalls: 600,
    monthlyEmailAlerts: 150,
    businessSitesIncluded: 1,
    businessEndpointsPerSite: 3,
    businessHttpIntervalSeconds: 60,
    businessScenariosPerSite: 1,
    businessScenarioIntervalMinutes: 120,
    businessTlsChecks: true,
    priorityAlerts: true,
    trialMaxBusinessSites: 1,
    trialMaxMonitors: 3,
    trialMaxWebTopics: 1,
    trialDailySearchCalls: 2,
    trialEmailAlerts: 10,
  },
};

/**
 * L'ancienne option « site professionnel supplémentaire » (14,99 €/mois, clé waverti_business_extra_site_monthly)
 * est abandonnée : elle n'est ni affichée, ni vendue, ni prise en compte dans les droits. Business comprend
 * un site professionnel surveillé. Le produit éventuellement créé dans Stripe reste inutilisé (cf. docs/STRIPE.md).
 */
export const RETIRED_STRIPE_LOOKUP_KEYS = ["waverti_business_extra_site_monthly"] as const;

export const PAID_PLAN_IDS = ["plus", "pro", "max", "business"] as const;
export type PaidPlanId = (typeof PAID_PLAN_IDS)[number];

export function isPaidPlanId(v: unknown): v is PaidPlanId {
  return typeof v === "string" && (PAID_PLAN_IDS as readonly string[]).includes(v);
}

export const TRIAL_HOURS = 72;

/** Liste des avantages affichés sur la page Tarifs (pas de promesses au-delà des quotas réels). */
export const PLAN_FEATURES: Record<PlanId, string[]> = {
  plus: [
    "20 surveillances, dont 3 sujets de recherche sur Internet",
    "Pages vérifiées toutes les 6 heures",
    "1 recherche par jour et par sujet",
    "30 alertes par e-mail par mois",
    "Surveillance continue par nos serveurs",
    "Application ordinateur, web et mobile",
  ],
  pro: [
    "100 surveillances, dont 10 sujets sur Internet",
    "Pages vérifiées toutes les 2 heures",
    "2 recherches par jour et par sujet",
    "80 alertes par e-mail par mois",
    "Historique avancé (12 mois) et exports",
    "Gestion avancée des surveillances",
  ],
  max: [
    "150 surveillances, dont 20 sujets sur Internet",
    "Pages vérifiées toutes les heures",
    "2 recherches par jour et par sujet",
    "150 alertes par e-mail par mois",
    "Historique avancé (12 mois) et exports",
    "Pour les utilisateurs intensifs, sans surveillance de site professionnel",
  ],
  business: [
    "Tout Pro, plus :",
    "150 alertes par e-mail par mois",
    "1 site professionnel avec 3 points de contrôle",
    "Vérification HTTP toutes les minutes",
    "1 scénario navigateur toutes les 2 heures",
    "Certificat HTTPS vérifié chaque jour",
    "Pannes confirmées avant alerte, alertes prioritaires",
    "Historique des incidents et rapports de disponibilité",
  ],
};
