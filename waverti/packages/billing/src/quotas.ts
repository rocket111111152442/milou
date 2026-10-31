/**
 * Vérifications de quotas — toujours exécutées côté serveur, avant toute écriture.
 */
import type { Entitlements } from "./entitlements";

export type QuotaErrorCode =
  | "subscription_required"
  | "monitor_limit"
  | "web_topic_limit"
  | "web_topics_not_included"
  | "interval_too_short"
  | "business_not_included"
  | "site_limit"
  | "endpoint_limit"
  | "scenario_limit"
  | "search_budget_exhausted";

export class QuotaError extends Error {
  constructor(
    public readonly code: QuotaErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "QuotaError";
  }
}

export interface MonitorCounts {
  total: number;
  webTopics: number;
}

export interface MonitorRequest {
  kind: "page" | "web_topic";
  intervalMinutes?: number;
  executionMode?: "auto" | "local_only" | "cloud_only";
}

export interface ResolvedMonitorSettings {
  intervalMinutes: number;
  executionMode: "auto" | "local_only" | "cloud_only";
}

/**
 * Vérifie qu'une nouvelle surveillance est autorisée et renvoie les réglages effectifs
 * (fréquence minimale de la formule, mode d'exécution compatible).
 */
export function checkNewMonitor(e: Entitlements, counts: MonitorCounts, req: MonitorRequest): ResolvedMonitorSettings {
  requireSubscription(e);
  if (counts.total >= e.maxMonitors) {
    throw new QuotaError("monitor_limit", `Votre formule permet ${e.maxMonitors} surveillance(s) au maximum.`);
  }
  if (req.kind === "web_topic") {
    if (e.maxWebTopics === 0 || e.webIntervalMinutes === null) {
      throw new QuotaError("web_topics_not_included", "La recherche sur Internet n'est pas incluse dans votre formule.");
    }
    if (counts.webTopics >= e.maxWebTopics) {
      throw new QuotaError("web_topic_limit", `Votre formule permet ${e.maxWebTopics} sujet(s) de recherche au maximum.`);
    }
  }
  return resolveSettings(e, req);
}

/** Aucune surveillance sans abonnement ou essai en cours (il n'existe pas de formule gratuite). */
export function requireSubscription(e: Entitlements): void {
  if (e.source === "none" || e.planId === null) {
    throw new QuotaError(
      "subscription_required",
      "Un abonnement ou un essai gratuit de 3 jours est nécessaire. Choisissez une formule pour commencer.",
    );
  }
}

export function resolveSettings(e: Entitlements, req: MonitorRequest): ResolvedMonitorSettings {
  const minInterval = req.kind === "web_topic" ? (e.webIntervalMinutes ?? 1440) : e.pageIntervalMinutes;
  const intervalMinutes = req.intervalMinutes ?? minInterval;
  if (intervalMinutes < minInterval) {
    throw new QuotaError("interval_too_short", `La fréquence minimale de votre formule est de ${minInterval} minutes.`);
  }
  let executionMode = req.executionMode ?? "auto";
  // Les clés d'API de recherche restent sur le serveur : les sujets Web sont toujours exécutés côté cloud.
  if (req.kind === "web_topic") executionMode = "cloud_only";
  // Sans relais cloud (droit non accordé), les contrôles de pages sont exclusivement locaux.
  else if (!e.cloudRelay) executionMode = "local_only";
  return { intervalMinutes, executionMode };
}

export function checkNewSite(e: Entitlements, siteCount: number): void {
  requireSubscription(e);
  if (e.businessSites === 0) {
    throw new QuotaError("business_not_included", "La surveillance de site professionnel nécessite la formule Business.");
  }
  if (siteCount >= e.businessSites) {
    throw new QuotaError("site_limit", `Votre abonnement inclut ${e.businessSites} site(s) professionnel(s).`);
  }
}

export function checkNewEndpoint(e: Entitlements, endpointCountForSite: number): void {
  if (e.businessSites === 0) throw new QuotaError("business_not_included", "Formule Business requise.");
  if (endpointCountForSite >= e.businessEndpointsPerSite) {
    throw new QuotaError("endpoint_limit", `${e.businessEndpointsPerSite} points de contrôle maximum par site.`);
  }
}

/**
 * Scénarios navigateur : au plus `businessScenariosPerSite` par site, et au plus `businessScenarios` pour tout le
 * compte.
 */
export function checkNewScenario(e: Entitlements, scenarioCountForSite: number, scenarioCountForAccount = scenarioCountForSite): void {
  if (e.businessSites === 0) throw new QuotaError("business_not_included", "Formule Business requise.");
  if (scenarioCountForSite >= e.businessScenariosPerSite) {
    throw new QuotaError("scenario_limit", `${e.businessScenariosPerSite} scénario(s) navigateur maximum par site.`);
  }
  if (scenarioCountForAccount >= e.businessScenarios) {
    throw new QuotaError(
      "scenario_limit",
      `Votre abonnement inclut ${e.businessScenarios} scénario(s) navigateur au total.`,
    );
  }
}

/**
 * Après un changement de formule : liste des surveillances à suspendre (les plus récentes
 * au-delà du quota) et de celles qui peuvent être réactivées.
 */
export function planQuotaEnforcement(
  e: Entitlements,
  monitors: Array<{ id: string; kind: "page" | "web_topic"; status: string; createdAt: Date }>,
): { pause: string[]; resume: string[] } {
  const sorted = [...monitors].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const pause: string[] = [];
  const resume: string[] = [];
  let total = 0;
  let topics = 0;
  for (const m of sorted) {
    const topicAllowed = m.kind !== "web_topic" || (e.maxWebTopics > 0 && topics < e.maxWebTopics);
    const allowed = total < e.maxMonitors && topicAllowed;
    if (allowed) {
      total++;
      if (m.kind === "web_topic") topics++;
      if (m.status === "paused_quota") resume.push(m.id);
    } else if (m.status !== "paused_quota") {
      pause.push(m.id);
    }
  }
  return { pause, resume };
}
