/**
 * Catalogue d'affichage des formules. Les valeurs de référence pour l'application des quotas
 * sont celles de la table `plans` (paramétrable) ; ce catalogue sert de repli pour les pages
 * publiques quand la base n'est pas joignable et doit rester aligné avec la migration de seed
 * (vérifié par le test catalog.int.test.ts).
 */
export type PlanId = "discovery" | "plus" | "pro" | "business";

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

export interface PlanDefinition extends PlanLimits {
  id: PlanId;
  name: string;
  description: string;
  priceCents: number;
  trialHours: number;
  sortOrder: number;
}

export const PLAN_CATALOG: Record<PlanId, PlanDefinition> = {
  discovery: {
    id: "discovery",
    name: "Découverte",
    description: "Surveillance locale de quelques pages, sans carte bancaire.",
    priceCents: 0,
    trialHours: 0,
    sortOrder: 10,
    maxMonitors: 3,
    maxWebTopics: 0,
    pageIntervalMinutes: 720,
    webIntervalMinutes: null,
    cloudRelay: false,
    emailAlerts: false,
    historyDays: 30,
    advancedHistory: false,
    dataExports: false,
    monthlySearchCalls: 0,
    businessSitesIncluded: 0,
    businessEndpointsPerSite: 0,
    businessHttpIntervalSeconds: 60,
    businessScenariosPerSite: 0,
    businessScenarioIntervalMinutes: 120,
    businessTlsChecks: false,
    priorityAlerts: false,
    trialMaxMonitors: 3,
    trialMaxWebTopics: 0,
    trialMaxBusinessSites: 0,
    trialDailySearchCalls: 0,
  },
  plus: {
    id: "plus",
    name: "Plus",
    description: "Surveillance hybride, recherche Web quotidienne et alertes e-mail.",
    priceCents: 599,
    trialHours: 72,
    sortOrder: 20,
    maxMonitors: 20,
    maxWebTopics: 3,
    pageIntervalMinutes: 360,
    webIntervalMinutes: 1440,
    cloudRelay: true,
    emailAlerts: true,
    historyDays: 90,
    advancedHistory: false,
    dataExports: false,
    monthlySearchCalls: 120,
    businessSitesIncluded: 0,
    businessEndpointsPerSite: 0,
    businessHttpIntervalSeconds: 60,
    businessScenariosPerSite: 0,
    businessScenarioIntervalMinutes: 120,
    businessTlsChecks: false,
    priorityAlerts: false,
    trialMaxMonitors: 3,
    trialMaxWebTopics: 1,
    trialMaxBusinessSites: 0,
    trialDailySearchCalls: 3,
  },
  pro: {
    id: "pro",
    name: "Pro",
    description: "Pour les usages intensifs : 100 surveillances, historique avancé et exports.",
    priceCents: 1499,
    trialHours: 72,
    sortOrder: 30,
    maxMonitors: 100,
    maxWebTopics: 15,
    pageIntervalMinutes: 120,
    webIntervalMinutes: 720,
    cloudRelay: true,
    emailAlerts: true,
    historyDays: 365,
    advancedHistory: true,
    dataExports: true,
    monthlySearchCalls: 1000,
    businessSitesIncluded: 0,
    businessEndpointsPerSite: 0,
    businessHttpIntervalSeconds: 60,
    businessScenariosPerSite: 0,
    businessScenarioIntervalMinutes: 120,
    businessTlsChecks: false,
    priorityAlerts: false,
    trialMaxMonitors: 3,
    trialMaxWebTopics: 1,
    trialMaxBusinessSites: 0,
    trialDailySearchCalls: 3,
  },
  business: {
    id: "business",
    name: "Business",
    description: "Toutes les fonctions Pro + la surveillance de votre site professionnel.",
    priceCents: 3999,
    trialHours: 72,
    sortOrder: 40,
    maxMonitors: 100,
    maxWebTopics: 15,
    pageIntervalMinutes: 120,
    webIntervalMinutes: 720,
    cloudRelay: true,
    emailAlerts: true,
    historyDays: 365,
    advancedHistory: true,
    dataExports: true,
    monthlySearchCalls: 1000,
    businessSitesIncluded: 1,
    businessEndpointsPerSite: 3,
    businessHttpIntervalSeconds: 60,
    businessScenariosPerSite: 1,
    businessScenarioIntervalMinutes: 120,
    businessTlsChecks: true,
    priorityAlerts: true,
    trialMaxMonitors: 3,
    trialMaxWebTopics: 1,
    trialMaxBusinessSites: 1,
    trialDailySearchCalls: 3,
  },
};

export const EXTRA_SITE_ADDON = {
  id: "business_extra_site",
  name: "Site professionnel supplémentaire",
  priceCents: 1499,
  requiresPlanId: "business" as PlanId,
  grantsBusinessSites: 1,
};

export const PAID_PLAN_IDS = ["plus", "pro", "business"] as const;
export type PaidPlanId = (typeof PAID_PLAN_IDS)[number];

export function isPaidPlanId(v: unknown): v is PaidPlanId {
  return typeof v === "string" && (PAID_PLAN_IDS as readonly string[]).includes(v);
}

export const TRIAL_HOURS = 72;

/** Liste des avantages affichés sur la page Tarifs (pas de promesses au-delà des quotas réels). */
export const PLAN_FEATURES: Record<PlanId, string[]> = {
  discovery: [
    "3 surveillances de pages",
    "Vérification toutes les 12 heures",
    "Fonctionne sur votre ordinateur, quand l'application est ouverte",
    "Notifications dans l'application",
    "Historique simple (30 jours)",
    "Sans carte bancaire",
  ],
  plus: [
    "20 surveillances, dont 3 sujets de recherche sur Internet",
    "Pages vérifiées toutes les 6 heures",
    "Recherche Web quotidienne par sujet",
    "Relais par nos serveurs quand votre PC est éteint",
    "Alertes par e-mail",
    "Application desktop et tableau de bord web",
  ],
  pro: [
    "100 surveillances, dont 15 sujets sur Internet",
    "Pages vérifiées toutes les 2 heures",
    "Recherche Web deux fois par jour et par sujet",
    "Fonctionnement hybride PC + serveurs",
    "Historique avancé (12 mois) et exports",
    "Gestion avancée des surveillances",
  ],
  business: [
    "Tout Pro, plus :",
    "1 site professionnel avec 3 points de contrôle",
    "Vérification HTTP toutes les minutes",
    "1 scénario navigateur toutes les 2 heures",
    "Certificat HTTPS vérifié chaque jour",
    "Pannes confirmées avant alerte, alertes prioritaires",
    "Historique des incidents et rapports de disponibilité",
    "Surveillance serveur indépendante de votre ordinateur",
  ],
};
