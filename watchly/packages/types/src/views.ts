/** Modèles de vue partagés entre le tableau de bord web, l'application desktop et la vitrine. */
export type MonitorKind = "page" | "web_topic";
export type MonitorStatus = "active" | "paused" | "paused_quota" | "error";
export type LastStatus = "pending" | "ok" | "triggered" | "error" | "skipped";
export type Executor = "agent" | "cloud";

export interface MonitorSummary {
  id: string;
  name: string;
  kind: MonitorKind;
  status: MonitorStatus;
  conditionLabel: string;
  targetLabel: string;
  lastStatus: LastStatus;
  lastCheckedAt: string | null;
  nextRunAt: string | null;
  intervalMinutes: number;
  lastValue: string | null;
  lastExecutor: Executor | null;
}

export interface ResultView {
  id: string;
  checkedAt: string;
  outcome: "ok" | "changed" | "triggered" | "error";
  executedBy: Executor;
  summary: string;
  value: string | null;
  sourceUrl: string | null;
}

export interface NotificationView {
  id: string;
  type: string;
  priority: "low" | "normal" | "high" | "critical";
  title: string;
  body: string;
  taskName: string | null;
  sourceUrl: string | null;
  linkPath: string | null;
  createdAt: string;
  readAt: string | null;
}

export interface DeviceView {
  id: string;
  name: string;
  platform: "windows" | "macos" | "linux";
  online: boolean;
  lastSeenAt: string | null;
  monitoringEnabled: boolean;
  appVersion: string | null;
}

export interface QuotaView {
  key: string;
  label: string;
  used: number;
  limit: number;
}

export interface SubscriptionView {
  planId: string;
  planName: string;
  status: string | null;
  isTrial: boolean;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

export interface OverviewData {
  activeMonitors: number;
  alertsLast7Days: number;
  upcoming: Array<Pick<MonitorSummary, "id" | "name" | "nextRunAt" | "kind">>;
  latestResults: Array<ResultView & { monitorId: string; monitorName: string }>;
  recentAlerts: NotificationView[];
  devices: DeviceView[];
  subscription: SubscriptionView;
  quotas: QuotaView[];
}

export type EndpointStateView = "unknown" | "up" | "down" | "degraded";

export interface SiteSummary {
  id: string;
  name: string;
  domain: string;
  status: "pending_verification" | "verified" | "suspended";
  state: EndpointStateView;
  /** Disponibilité mesurée sur 30 jours, null si pas encore de données. */
  uptime30d: number | null;
  openIncidents: number;
  avgResponseMs: number | null;
  tlsValidTo: string | null;
}

export interface UptimeDayView {
  day: string;
  checks: number;
  failures: number;
  /** null = aucune mesure ce jour-là (affiché « donnée indisponible »). */
  uptime: number | null;
}

export interface IncidentView {
  id: string;
  siteName: string;
  title: string;
  kind: "downtime" | "tls" | "scenario";
  status: "open" | "resolved";
  startedAt: string;
  resolvedAt: string | null;
  durationSeconds: number | null;
  cause: string | null;
}
