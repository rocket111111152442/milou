/**
 * DONNÉES DE DÉMONSTRATION FICTIVES.
 * Utilisées uniquement sur le site public (vitrine, démonstration interactive, captures d'écran
 * construites avec les vrais composants). Aucun produit, site ou chiffre réel.
 */
import type {
  IncidentView,
  MonitorSummary,
  NotificationView,
  OverviewData,
  ResultView,
  SiteSummary,
} from "@watchly/types";

/** Date de référence fixe : les rendus de démonstration sont stables (pas d'hydratation divergente). */
export const DEMO_NOW = new Date("2026-11-03T09:00:00+01:00");
const ago = (minutes: number) => new Date(DEMO_NOW.getTime() - minutes * 60_000).toISOString();
const inMin = (minutes: number) => new Date(DEMO_NOW.getTime() + minutes * 60_000).toISOString();

export const demoMonitors: MonitorSummary[] = [
  {
    id: "demo-1",
    name: "Ordinateur portable 15″ (exemple)",
    kind: "page",
    status: "active",
    conditionLabel: "Prix sous 800 €",
    targetLabel: "boutique-exemple.fr",
    lastStatus: "triggered",
    lastCheckedAt: ago(12),
    nextRunAt: inMin(108),
    intervalMinutes: 120,
    lastValue: "789,00 €",
    lastExecutor: "agent",
  },
  {
    id: "demo-2",
    name: "Console — retour en stock",
    kind: "page",
    status: "active",
    conditionLabel: "Retour en stock",
    targetLabel: "magasin-demo.fr",
    lastStatus: "ok",
    lastCheckedAt: ago(35),
    nextRunAt: inMin(85),
    intervalMinutes: 120,
    lastValue: "Rupture",
    lastExecutor: "cloud",
  },
  {
    id: "demo-3",
    name: "Date de sortie « Projet Aurora »",
    kind: "web_topic",
    status: "active",
    conditionLabel: "Annonce officielle",
    targetLabel: "Recherche sur Internet",
    lastStatus: "ok",
    lastCheckedAt: ago(240),
    nextRunAt: inMin(480),
    intervalMinutes: 720,
    lastValue: "Rumeur",
    lastExecutor: "cloud",
  },
  {
    id: "demo-4",
    name: "Offres de stage — design produit",
    kind: "web_topic",
    status: "paused",
    conditionLabel: "Nouvelle offre",
    targetLabel: "Recherche sur Internet",
    lastStatus: "ok",
    lastCheckedAt: ago(2880),
    nextRunAt: null,
    intervalMinutes: 1440,
    lastValue: null,
    lastExecutor: "cloud",
  },
];

export const demoNotifications: NotificationView[] = [
  {
    id: "n1",
    type: "price",
    priority: "normal",
    title: "Le prix est passé sous 800 €",
    body: "Ordinateur portable 15″ (exemple) : 789,00 € au lieu de 899,00 € lors du contrôle précédent.",
    taskName: "Ordinateur portable 15″ (exemple)",
    sourceUrl: null,
    linkPath: null,
    createdAt: ago(12),
    readAt: null,
  },
  {
    id: "n2",
    type: "business_recovered",
    priority: "high",
    title: "boutique-exemple.fr est de nouveau disponible",
    body: "Panne résolue après 17 minutes. La page d'accueil répond en 182 ms.",
    taskName: null,
    sourceUrl: null,
    linkPath: null,
    createdAt: ago(95),
    readAt: null,
  },
  {
    id: "n3",
    type: "web_topic",
    priority: "normal",
    title: "Nouvelle information probable sur « Projet Aurora »",
    body: "Un média spécialisé évoque une sortie au printemps. Information non confirmée par l'éditeur.",
    taskName: "Date de sortie « Projet Aurora »",
    sourceUrl: null,
    linkPath: null,
    createdAt: ago(300),
    readAt: ago(200),
  },
];

export const demoResults: ResultView[] = [
  {
    id: "r1",
    checkedAt: ago(12),
    outcome: "triggered",
    executedBy: "agent",
    summary: "Prix relevé : 789,00 € (seuil 800 €).",
    value: "789,00 €",
    sourceUrl: null,
  },
  {
    id: "r2",
    checkedAt: ago(132),
    outcome: "changed",
    executedBy: "agent",
    summary: "Baisse de prix : 899,00 € → 879,00 €, au-dessus du seuil.",
    value: "879,00 €",
    sourceUrl: null,
  },
  {
    id: "r3",
    checkedAt: ago(252),
    outcome: "ok",
    executedBy: "cloud",
    summary: "Ordinateur éteint : contrôle effectué par les serveurs Watchly. Prix inchangé.",
    value: "899,00 €",
    sourceUrl: null,
  },
  {
    id: "r4",
    checkedAt: ago(372),
    outcome: "ok",
    executedBy: "agent",
    summary: "Prix inchangé.",
    value: "899,00 €",
    sourceUrl: null,
  },
];

export const demoOverview: OverviewData = {
  activeMonitors: 3,
  alertsLast7Days: 4,
  upcoming: demoMonitors
    .filter((m) => m.nextRunAt)
    .map((m) => ({ id: m.id, name: m.name, nextRunAt: m.nextRunAt, kind: m.kind })),
  latestResults: demoResults.slice(0, 3).map((r) => ({ ...r, monitorId: "demo-1", monitorName: "Ordinateur 15″" })),
  recentAlerts: demoNotifications,
  devices: [
    {
      id: "d1",
      name: "PC du bureau",
      platform: "windows",
      online: true,
      lastSeenAt: ago(1),
      monitoringEnabled: true,
      appVersion: "0.1.0",
    },
  ],
  subscription: {
    planId: "pro",
    planName: "Pro",
    status: "active",
    isTrial: false,
    trialEndsAt: null,
    currentPeriodEnd: inMin(60 * 24 * 21),
    cancelAtPeriodEnd: false,
  },
  quotas: [
    { key: "monitors", label: "Surveillances", used: 4, limit: 100 },
    { key: "topics", label: "Sujets sur Internet", used: 2, limit: 15 },
  ],
};

export const demoSites: SiteSummary[] = [
  {
    id: "s1",
    name: "Boutique exemple",
    domain: "boutique-exemple.fr",
    status: "verified",
    state: "up",
    uptime30d: 0.9962,
    openIncidents: 0,
    avgResponseMs: 184,
    tlsValidTo: "2027-02-11T00:00:00Z",
  },
];

export const demoIncidents: IncidentView[] = [
  {
    id: "i1",
    siteName: "Boutique exemple",
    title: "Page d'accueil indisponible (HTTP 503)",
    kind: "downtime",
    status: "resolved",
    startedAt: ago(112),
    resolvedAt: ago(95),
    durationSeconds: 17 * 60,
    cause: "Le serveur a répondu 503 Service Unavailable.",
  },
];
