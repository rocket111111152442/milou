/**
 * Schéma Drizzle — miroir typé des migrations SQL de `db/migrations`.
 * Les migrations SQL restent la source de vérité ; le test d'intégration
 * `schema-sync.test.ts` vérifie que chaque table/colonne déclarée ici existe en base.
 */
import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  customType,
  date,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return "bytea";
  },
});

export const plans = pgTable("plans", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  priceCents: integer("price_cents").notNull(),
  currency: text("currency").notNull(),
  billingInterval: text("billing_interval").notNull(),
  stripePriceId: text("stripe_price_id"),
  stripeLookupKey: text("stripe_lookup_key"),
  trialHours: integer("trial_hours").notNull(),
  isPublic: boolean("is_public").notNull(),
  sortOrder: integer("sort_order").notNull(),
  maxMonitors: integer("max_monitors").notNull(),
  maxWebTopics: integer("max_web_topics").notNull(),
  pageIntervalMinutes: integer("page_interval_minutes").notNull(),
  webIntervalMinutes: integer("web_interval_minutes"),
  cloudRelay: boolean("cloud_relay").notNull(),
  emailAlerts: boolean("email_alerts").notNull(),
  historyDays: integer("history_days").notNull(),
  advancedHistory: boolean("advanced_history").notNull(),
  dataExports: boolean("data_exports").notNull(),
  monthlySearchCalls: integer("monthly_search_calls").notNull(),
  monthlyEmailAlerts: integer("monthly_email_alerts").notNull(),
  businessSitesIncluded: integer("business_sites_included").notNull(),
  businessEndpointsPerSite: integer("business_endpoints_per_site").notNull(),
  businessHttpIntervalSeconds: integer("business_http_interval_seconds").notNull(),
  businessScenariosPerSite: integer("business_scenarios_per_site").notNull(),
  businessScenarioIntervalMinutes: integer("business_scenario_interval_minutes").notNull(),
  businessTlsChecks: boolean("business_tls_checks").notNull(),
  priorityAlerts: boolean("priority_alerts").notNull(),
  trialMaxMonitors: integer("trial_max_monitors").notNull(),
  trialMaxWebTopics: integer("trial_max_web_topics").notNull(),
  trialMaxBusinessSites: integer("trial_max_business_sites").notNull(),
  trialDailySearchCalls: integer("trial_daily_search_calls").notNull(),
  trialEmailAlerts: integer("trial_email_alerts").notNull(),
  createdAt: ts("created_at").notNull(),
  updatedAt: ts("updated_at").notNull(),
});

export const planAddons = pgTable("plan_addons", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  priceCents: integer("price_cents").notNull(),
  currency: text("currency").notNull(),
  stripePriceId: text("stripe_price_id"),
  stripeLookupKey: text("stripe_lookup_key"),
  requiresPlanId: text("requires_plan_id").notNull(),
  grantsBusinessSites: integer("grants_business_sites").notNull(),
  isPublic: boolean("is_public").notNull(),
  createdAt: ts("created_at").notNull(),
});

/** Identités (auto-hébergées) : e-mail, empreinte du mot de passe, double authentification. */
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull(),
  emailVerifiedAt: ts("email_verified_at"),
  passwordHash: text("password_hash"),
  passwordChangedAt: ts("password_changed_at"),
  totpSecretEnc: text("totp_secret_enc"),
  totpPendingEnc: text("totp_pending_enc"),
  totpEnabledAt: ts("totp_enabled_at"),
  totpLastStep: bigint("totp_last_step", { mode: "number" }),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const userSessions = pgTable("user_sessions", {
  id: text("id").primaryKey(),
  userId: uuid("user_id").notNull(),
  aal: smallint("aal").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
  lastSeenAt: ts("last_seen_at").notNull().defaultNow(),
  expiresAt: ts("expires_at").notNull(),
  ipHash: text("ip_hash"),
  userAgent: text("user_agent"),
});

export const authTokens = pgTable("auth_tokens", {
  tokenHash: text("token_hash").primaryKey(),
  userId: uuid("user_id").notNull(),
  purpose: text("purpose").$type<"verify_email" | "reset_password">().notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
  expiresAt: ts("expires_at").notNull(),
  usedAt: ts("used_at"),
});

export const mfaRecoveryCodes = pgTable("mfa_recovery_codes", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  userId: uuid("user_id").notNull(),
  codeHash: text("code_hash").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
  usedAt: ts("used_at"),
});

export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(),
  email: text("email").notNull(),
  displayName: text("display_name"),
  role: text("role").$type<"user" | "business" | "admin">().notNull(),
  locale: text("locale").notNull(),
  timezone: text("timezone").notNull(),
  notifyEmail: boolean("notify_email").notNull(),
  notifyInapp: boolean("notify_inapp").notNull(),
  notifyDesktop: boolean("notify_desktop").notNull(),
  marketingOptIn: boolean("marketing_opt_in").notNull(),
  onboardingStep: text("onboarding_step").notNull(),
  onboardingCompletedAt: ts("onboarding_completed_at"),
  stripeCustomerId: text("stripe_customer_id"),
  suspendedAt: ts("suspended_at"),
  suspensionReason: text("suspension_reason"),
  deletionRequestedAt: ts("deletion_requested_at"),
  lastSeenAt: ts("last_seen_at"),
  createdAt: ts("created_at").notNull(),
  updatedAt: ts("updated_at").notNull(),
});

export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "incomplete"
  | "incomplete_expired"
  | "unpaid"
  | "paused";

export const subscriptions = pgTable("subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  planId: text("plan_id").notNull(),
  stripeSubscriptionId: text("stripe_subscription_id").notNull(),
  stripeCustomerId: text("stripe_customer_id").notNull(),
  status: text("status").$type<SubscriptionStatus>().notNull(),
  extraSites: integer("extra_sites").notNull().default(0),
  trialStart: ts("trial_start"),
  trialEnd: ts("trial_end"),
  currentPeriodStart: ts("current_period_start"),
  currentPeriodEnd: ts("current_period_end"),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
  canceledAt: ts("canceled_at"),
  endedAt: ts("ended_at"),
  lastEventAt: ts("last_event_at"),
  trialReminderSentAt: ts("trial_reminder_sent_at"),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const entitlements = pgTable("entitlements", {
  userId: uuid("user_id").primaryKey(),
  /** null : aucun abonnement valide (pas de formule gratuite). */
  planId: text("plan_id"),
  source: text("source").$type<"none" | "trial" | "subscription" | "grace" | "admin_grant">().notNull(),
  subscriptionStatus: text("subscription_status"),
  maxMonitors: integer("max_monitors").notNull(),
  maxWebTopics: integer("max_web_topics").notNull(),
  pageIntervalMinutes: integer("page_interval_minutes").notNull(),
  webIntervalMinutes: integer("web_interval_minutes"),
  cloudRelay: boolean("cloud_relay").notNull(),
  emailAlerts: boolean("email_alerts").notNull(),
  historyDays: integer("history_days").notNull(),
  advancedHistory: boolean("advanced_history").notNull(),
  dataExports: boolean("data_exports").notNull(),
  monthlySearchCalls: integer("monthly_search_calls").notNull(),
  dailySearchCalls: integer("daily_search_calls"),
  monthlyEmailAlerts: integer("monthly_email_alerts").notNull(),
  businessSites: integer("business_sites").notNull(),
  businessEndpointsPerSite: integer("business_endpoints_per_site").notNull(),
  businessHttpIntervalSeconds: integer("business_http_interval_seconds").notNull(),
  businessScenariosPerSite: integer("business_scenarios_per_site").notNull(),
  businessScenariosTotal: integer("business_scenarios_total").notNull(),
  businessScenarioIntervalMinutes: integer("business_scenario_interval_minutes").notNull(),
  businessTlsChecks: boolean("business_tls_checks").notNull(),
  priorityAlerts: boolean("priority_alerts").notNull(),
  validUntil: ts("valid_until"),
  computedAt: ts("computed_at").notNull().defaultNow(),
});

/** Compteurs de consommation (recherches, alertes e-mail…) — incrément atomique conditionnel. */
export const usageCounters = pgTable("usage_counters", {
  userId: uuid("user_id"),
  metric: text("metric").notNull(),
  period: text("period").notNull(),
  value: bigint("value", { mode: "number" }).notNull(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const trialUsage = pgTable("trial_usage", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id"),
  emailHash: text("email_hash").notNull(),
  cardFingerprintHash: text("card_fingerprint_hash"),
  planId: text("plan_id").notNull(),
  stripeSubscriptionId: text("stripe_subscription_id"),
  status: text("status").$type<"started" | "converted" | "canceled" | "blocked_duplicate">().notNull(),
  startedAt: ts("started_at").notNull().defaultNow(),
  endedAt: ts("ended_at"),
});

export const billingEvents = pgTable("billing_events", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  stripeCreatedAt: ts("stripe_created_at").notNull(),
  receivedAt: ts("received_at").notNull().defaultNow(),
  processedAt: ts("processed_at"),
  status: text("status").$type<"received" | "processed" | "ignored" | "failed">().notNull(),
  attempts: integer("attempts").notNull().default(0),
  error: text("error"),
  userId: uuid("user_id"),
  summary: jsonb("summary").$type<Record<string, unknown>>().notNull(),
});

export const agentDevices = pgTable("agent_devices", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  name: text("name").notNull(),
  platform: text("platform").$type<"windows" | "macos" | "linux">().notNull(),
  appVersion: text("app_version"),
  tokenHash: text("token_hash").notNull(),
  status: text("status").$type<"active" | "revoked">().notNull(),
  consentLocalAt: ts("consent_local_at"),
  consentVersion: text("consent_version"),
  monitoringEnabled: boolean("monitoring_enabled").notNull(),
  lastSeenAt: ts("last_seen_at"),
  lastState: text("last_state").$type<"idle" | "running" | "paused">(),
  createdAt: ts("created_at").notNull().defaultNow(),
  revokedAt: ts("revoked_at"),
});

export const agentLinkRequests = pgTable("agent_link_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  deviceCodeHash: text("device_code_hash").notNull(),
  userCode: text("user_code").notNull(),
  deviceName: text("device_name").notNull(),
  platform: text("platform").$type<"windows" | "macos" | "linux">().notNull(),
  appVersion: text("app_version"),
  status: text("status").$type<"pending" | "approved" | "denied" | "consumed" | "expired">().notNull(),
  userId: uuid("user_id"),
  deviceId: uuid("device_id"),
  expiresAt: ts("expires_at").notNull(),
  approvedAt: ts("approved_at"),
  lastPolledAt: ts("last_polled_at"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const agentHeartbeats = pgTable("agent_heartbeats", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  deviceId: uuid("device_id").notNull(),
  userId: uuid("user_id").notNull(),
  receivedAt: ts("received_at").notNull().defaultNow(),
  state: text("state").$type<"idle" | "running" | "paused">().notNull(),
  runningJobs: integer("running_jobs").notNull(),
  appVersion: text("app_version"),
});

export type TaskKind = "page" | "web_topic";
export type TaskStatus = "active" | "paused" | "paused_quota" | "error";
export type ExecutionMode = "auto" | "local_only" | "cloud_only";

export const monitoringTasks = pgTable("monitoring_tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  kind: text("kind").$type<TaskKind>().notNull(),
  name: text("name").notNull(),
  status: text("status").$type<TaskStatus>().notNull().default("active"),
  condition: jsonb("condition").$type<Record<string, unknown>>().notNull(),
  executionMode: text("execution_mode").$type<ExecutionMode>().notNull().default("auto"),
  notifyInapp: boolean("notify_inapp").notNull().default(true),
  notifyEmail: boolean("notify_email").notNull().default(true),
  notifyDesktop: boolean("notify_desktop").notNull().default(true),
  lastStatus: text("last_status")
    .$type<"pending" | "ok" | "triggered" | "error" | "skipped">()
    .notNull()
    .default("pending"),
  lastCheckedAt: ts("last_checked_at"),
  lastTriggeredAt: ts("last_triggered_at"),
  lastError: text("last_error"),
  consecutiveErrors: integer("consecutive_errors").notNull().default(0),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const monitoringTargets = pgTable("monitoring_targets", {
  taskId: uuid("task_id").primaryKey(),
  userId: uuid("user_id").notNull(),
  targetType: text("target_type").$type<"url" | "search_topic">().notNull(),
  url: text("url"),
  urlHash: text("url_hash"),
  host: text("host"),
  cssSelector: text("css_selector"),
  renderMode: text("render_mode").$type<"auto" | "http" | "browser">().notNull().default("auto"),
  topic: text("topic"),
  searchQueries: text("search_queries").array().notNull().default(sql`'{}'::text[]`),
  officialDomains: text("official_domains").array().notNull().default(sql`'{}'::text[]`),
  requireOfficial: boolean("require_official").notNull().default(false),
});

export const monitoringSchedules = pgTable("monitoring_schedules", {
  taskId: uuid("task_id").primaryKey(),
  userId: uuid("user_id").notNull(),
  intervalMinutes: integer("interval_minutes").notNull(),
  nextRunAt: ts("next_run_at").notNull(),
  lastScheduledAt: ts("last_scheduled_at"),
  jitterSeconds: integer("jitter_seconds").notNull().default(0),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export type JobStatus =
  | "pending"
  | "claimed"
  | "succeeded"
  | "failed"
  | "skipped"
  | "expired"
  | "canceled";

export const monitoringJobs = pgTable("monitoring_jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  taskId: uuid("task_id").notNull(),
  userId: uuid("user_id").notNull(),
  kind: text("kind").$type<TaskKind>().notNull(),
  slotAt: ts("slot_at").notNull(),
  status: text("status").$type<JobStatus>().notNull().default("pending"),
  preferredExecutor: text("preferred_executor").$type<"agent" | "cloud">().notNull(),
  allowCloud: boolean("allow_cloud").notNull(),
  allowAgent: boolean("allow_agent").notNull(),
  agentDeadlineAt: ts("agent_deadline_at"),
  claimedBy: text("claimed_by").$type<"agent" | "cloud">(),
  claimedDeviceId: uuid("claimed_device_id"),
  claimToken: uuid("claim_token"),
  workerId: text("worker_id"),
  leaseExpiresAt: ts("lease_expires_at"),
  attempts: integer("attempts").notNull().default(0),
  maxAttempts: integer("max_attempts").notNull().default(3),
  priority: integer("priority").notNull().default(100),
  manual: boolean("manual").notNull().default(false),
  lastError: text("last_error"),
  createdAt: ts("created_at").notNull().defaultNow(),
  claimedAt: ts("claimed_at"),
  finishedAt: ts("finished_at"),
});

export const monitoringResults = pgTable("monitoring_results", {
  id: uuid("id").primaryKey().defaultRandom(),
  jobId: uuid("job_id"),
  taskId: uuid("task_id").notNull(),
  userId: uuid("user_id").notNull(),
  executedBy: text("executed_by").$type<"agent" | "cloud">().notNull(),
  deviceId: uuid("device_id"),
  checkedAt: ts("checked_at").notNull().defaultNow(),
  outcome: text("outcome").$type<"ok" | "changed" | "triggered" | "error">().notNull(),
  observation: jsonb("observation").$type<Record<string, unknown> | null>(),
  changeSummary: jsonb("change_summary").$type<Record<string, unknown> | null>(),
  errorCode: text("error_code"),
  errorMessage: text("error_message"),
  durationMs: integer("duration_ms"),
  fromCache: boolean("from_cache").notNull().default(false),
});

export const monitoringSeenItems = pgTable(
  "monitoring_seen_items",
  {
    taskId: uuid("task_id").notNull(),
    userId: uuid("user_id").notNull(),
    fingerprint: text("fingerprint").notNull(),
    url: text("url").notNull(),
    title: text("title"),
    classification: text("classification")
      .$type<"confirmed" | "probable" | "rumor" | "irrelevant">()
      .notNull(),
    firstSeenAt: ts("first_seen_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.taskId, t.fingerprint] })],
);

export const searchCache = pgTable("search_cache", {
  queryHash: text("query_hash").primaryKey(),
  provider: text("provider").notNull(),
  query: text("query").notNull(),
  results: jsonb("results").$type<unknown>().notNull(),
  fetchedAt: ts("fetched_at").notNull().defaultNow(),
  expiresAt: ts("expires_at").notNull(),
  hitCount: integer("hit_count").notNull().default(0),
});

export const pageCache = pgTable("page_cache", {
  cacheKey: text("cache_key").primaryKey(),
  urlHash: text("url_hash").notNull(),
  observation: jsonb("observation").$type<Record<string, unknown>>().notNull(),
  fetchedAt: ts("fetched_at").notNull().defaultNow(),
  expiresAt: ts("expires_at").notNull(),
  hitCount: integer("hit_count").notNull().default(0),
});

export const businessSites = pgTable("business_sites", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  name: text("name").notNull(),
  domain: text("domain").notNull(),
  status: text("status").$type<"pending_verification" | "verified" | "suspended">().notNull(),
  verificationToken: text("verification_token").notNull(),
  verificationMethod: text("verification_method").$type<"dns" | "file">(),
  verifiedAt: ts("verified_at"),
  lastVerificationAttemptAt: ts("last_verification_attempt_at"),
  tlsValidTo: ts("tls_valid_to"),
  tlsIssuer: text("tls_issuer"),
  tlsCheckedAt: ts("tls_checked_at"),
  tlsError: text("tls_error"),
  nextTlsCheckAt: ts("next_tls_check_at"),
  tlsLeaseExpiresAt: ts("tls_lease_expires_at"),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const siteVerifications = pgTable("site_verifications", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  siteId: uuid("site_id").notNull(),
  userId: uuid("user_id").notNull(),
  method: text("method").$type<"dns" | "file">().notNull(),
  success: boolean("success").notNull(),
  detail: text("detail"),
  attemptedAt: ts("attempted_at").notNull().defaultNow(),
});

export type EndpointState = "unknown" | "up" | "down" | "degraded";

export const businessEndpoints = pgTable("business_endpoints", {
  id: uuid("id").primaryKey().defaultRandom(),
  siteId: uuid("site_id").notNull(),
  userId: uuid("user_id").notNull(),
  name: text("name").notNull(),
  url: text("url").notNull(),
  method: text("method").$type<"GET" | "HEAD">().notNull().default("GET"),
  expectedStatusMin: integer("expected_status_min").notNull().default(200),
  expectedStatusMax: integer("expected_status_max").notNull().default(399),
  expectedKeyword: text("expected_keyword"),
  timeoutMs: integer("timeout_ms").notNull().default(10000),
  intervalSeconds: integer("interval_seconds").notNull().default(60),
  slowThresholdMs: integer("slow_threshold_ms").notNull().default(3000),
  enabled: boolean("enabled").notNull().default(true),
  state: text("state").$type<EndpointState>().notNull().default("unknown"),
  consecutiveFailures: integer("consecutive_failures").notNull().default(0),
  consecutiveSuccesses: integer("consecutive_successes").notNull().default(0),
  lastCheckedAt: ts("last_checked_at"),
  lastResponseMs: integer("last_response_ms"),
  lastStatusCode: integer("last_status_code"),
  lastError: text("last_error"),
  nextCheckAt: ts("next_check_at").notNull().defaultNow(),
  leaseExpiresAt: ts("lease_expires_at"),
  leaseOwner: text("lease_owner"),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const businessChecks = pgTable("business_checks", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  endpointId: uuid("endpoint_id").notNull(),
  siteId: uuid("site_id").notNull(),
  userId: uuid("user_id").notNull(),
  checkedAt: ts("checked_at").notNull().defaultNow(),
  ok: boolean("ok").notNull(),
  statusCode: integer("status_code"),
  responseMs: integer("response_ms"),
  errorCode: text("error_code"),
  isConfirmation: boolean("is_confirmation").notNull().default(false),
});

export const businessDailyStats = pgTable(
  "business_daily_stats",
  {
    endpointId: uuid("endpoint_id").notNull(),
    siteId: uuid("site_id").notNull(),
    userId: uuid("user_id").notNull(),
    day: date("day", { mode: "string" }).notNull(),
    checks: integer("checks").notNull(),
    failures: integer("failures").notNull(),
    avgResponseMs: integer("avg_response_ms"),
    p95ResponseMs: integer("p95_response_ms"),
    downtimeSeconds: integer("downtime_seconds").notNull(),
  },
  (t) => [primaryKey({ columns: [t.endpointId, t.day] })],
);

export const browserTestScenarios = pgTable("browser_test_scenarios", {
  id: uuid("id").primaryKey().defaultRandom(),
  siteId: uuid("site_id").notNull(),
  userId: uuid("user_id").notNull(),
  name: text("name").notNull(),
  startUrl: text("start_url").notNull(),
  steps: jsonb("steps").$type<unknown[]>().notNull(),
  intervalMinutes: integer("interval_minutes").notNull().default(120),
  enabled: boolean("enabled").notNull().default(true),
  nextRunAt: ts("next_run_at").notNull().defaultNow(),
  leaseExpiresAt: ts("lease_expires_at"),
  leaseOwner: text("lease_owner"),
  consecutiveFailures: integer("consecutive_failures").notNull().default(0),
  lastStatus: text("last_status").$type<"passed" | "failed" | "error">(),
  lastRunAt: ts("last_run_at"),
  lastDurationMs: integer("last_duration_ms"),
  lastError: text("last_error"),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const artifacts = pgTable("artifacts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  kind: text("kind").$type<"screenshot">().notNull(),
  contentType: text("content_type").$type<"image/jpeg" | "image/png">().notNull(),
  bytes: bytea("bytes").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
  expiresAt: ts("expires_at").notNull(),
});

export const browserTestRuns = pgTable("browser_test_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  scenarioId: uuid("scenario_id").notNull(),
  siteId: uuid("site_id").notNull(),
  userId: uuid("user_id").notNull(),
  startedAt: ts("started_at").notNull(),
  finishedAt: ts("finished_at"),
  status: text("status").$type<"passed" | "failed" | "error">().notNull(),
  failedStep: integer("failed_step"),
  error: text("error"),
  screenshotId: uuid("screenshot_id"),
  durationMs: integer("duration_ms"),
  stepResults: jsonb("step_results").$type<unknown[]>().notNull(),
});

export const incidents = pgTable("incidents", {
  id: uuid("id").primaryKey().defaultRandom(),
  siteId: uuid("site_id").notNull(),
  userId: uuid("user_id").notNull(),
  endpointId: uuid("endpoint_id"),
  scenarioId: uuid("scenario_id"),
  kind: text("kind").$type<"downtime" | "tls" | "scenario">().notNull(),
  status: text("status").$type<"open" | "resolved">().notNull().default("open"),
  title: text("title").notNull(),
  cause: text("cause"),
  startedAt: ts("started_at").notNull(),
  confirmedAt: ts("confirmed_at"),
  resolvedAt: ts("resolved_at"),
  lastError: text("last_error"),
  screenshotId: uuid("screenshot_id"),
  failedChecks: integer("failed_checks").notNull().default(0),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const incidentEvents = pgTable("incident_events", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  incidentId: uuid("incident_id").notNull(),
  userId: uuid("user_id").notNull(),
  at: ts("at").notNull().defaultNow(),
  type: text("type")
    .$type<"detected" | "confirmed" | "notified" | "check_failed" | "recovered" | "note">()
    .notNull(),
  message: text("message").notNull(),
});

export type NotificationType =
  | "price"
  | "stock"
  | "page_change"
  | "keyword"
  | "web_topic"
  | "business_down"
  | "business_recovered"
  | "business_tls"
  | "business_scenario"
  | "subscription"
  | "trial"
  | "system";
export type Priority = "low" | "normal" | "high" | "critical";

export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  type: text("type").$type<NotificationType>().notNull(),
  priority: text("priority").$type<Priority>().notNull().default("normal"),
  title: text("title").notNull(),
  body: text("body").notNull(),
  taskId: uuid("task_id"),
  taskName: text("task_name"),
  siteId: uuid("site_id"),
  incidentId: uuid("incident_id"),
  resultId: uuid("result_id"),
  sourceUrl: text("source_url"),
  linkPath: text("link_path"),
  dedupKey: text("dedup_key"),
  emailStatus: text("email_status")
    .$type<"none" | "pending" | "sent" | "failed" | "skipped">()
    .notNull()
    .default("none"),
  desktopStatus: text("desktop_status").$type<"none" | "pending" | "delivered">().notNull().default("none"),
  readAt: ts("read_at"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const emailOutbox = pgTable("email_outbox", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id"),
  notificationId: uuid("notification_id"),
  toEmail: text("to_email").notNull(),
  template: text("template").notNull(),
  subject: text("subject").notNull(),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
  priority: text("priority").$type<Priority>().notNull().default("normal"),
  status: text("status").$type<"pending" | "sending" | "sent" | "failed" | "canceled">().notNull().default("pending"),
  attempts: integer("attempts").notNull().default(0),
  nextAttemptAt: ts("next_attempt_at").notNull().defaultNow(),
  leaseExpiresAt: ts("lease_expires_at"),
  lastError: text("last_error"),
  providerMessageId: text("provider_message_id"),
  idempotencyKey: text("idempotency_key"),
  createdAt: ts("created_at").notNull().defaultNow(),
  sentAt: ts("sent_at"),
});

export type ApiProvider = "brave_search" | "resend" | "playwright" | "http_fetch" | "tls_check";

export const apiUsage = pgTable("api_usage", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  occurredAt: ts("occurred_at").notNull().defaultNow(),
  provider: text("provider").$type<ApiProvider>().notNull(),
  userId: uuid("user_id"),
  planId: text("plan_id"),
  units: integer("units").notNull().default(1),
  estimatedCostMicros: bigint("estimated_cost_micros", { mode: "number" }).notNull().default(0),
  executedBy: text("executed_by").$type<"agent" | "cloud">(),
  cacheHit: boolean("cache_hit").notNull().default(false),
  meta: jsonb("meta").$type<Record<string, unknown>>().notNull().default({}),
});

export const workerHeartbeats = pgTable("worker_heartbeats", {
  workerId: text("worker_id").primaryKey(),
  hostname: text("hostname").notNull(),
  version: text("version"),
  role: text("role").notNull(),
  startedAt: ts("started_at").notNull(),
  lastSeenAt: ts("last_seen_at").notNull().defaultNow(),
  jobsSucceeded: bigint("jobs_succeeded", { mode: "number" }).notNull().default(0),
  jobsFailed: bigint("jobs_failed", { mode: "number" }).notNull().default(0),
  stats: jsonb("stats").$type<Record<string, unknown>>().notNull().default({}),
});

export const appSettings = pgTable("app_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").$type<unknown>().notNull(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
  updatedBy: uuid("updated_by"),
});

export const adminAuditLogs = pgTable("admin_audit_logs", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  adminId: uuid("admin_id"),
  action: text("action").notNull(),
  targetType: text("target_type").notNull(),
  targetId: text("target_id"),
  reason: text("reason"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const supportTickets = pgTable("support_tickets", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id"),
  email: text("email").notNull(),
  subject: text("subject").notNull(),
  category: text("category")
    .$type<"account" | "billing" | "monitoring" | "business" | "desktop" | "privacy" | "abuse" | "other">()
    .notNull()
    .default("other"),
  status: text("status").$type<"open" | "pending" | "closed">().notNull().default("open"),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const supportMessages = pgTable("support_messages", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  ticketId: uuid("ticket_id").notNull(),
  userId: uuid("user_id"),
  author: text("author").$type<"user" | "staff">().notNull(),
  body: text("body").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const rateLimits = pgTable(
  "rate_limits",
  {
    bucket: text("bucket").notNull(),
    windowStart: ts("window_start").notNull(),
    hits: integer("hits").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.bucket, t.windowStart] })],
);

export const desktopReleases = pgTable("desktop_releases", {
  id: uuid("id").primaryKey().defaultRandom(),
  version: text("version").notNull(),
  platform: text("platform").$type<"windows" | "macos" | "linux">().notNull(),
  arch: text("arch").$type<"x86_64" | "aarch64" | "universal">().notNull(),
  packageType: text("package_type").$type<"msi" | "nsis" | "dmg" | "appimage" | "deb" | "rpm">().notNull(),
  url: text("url").notNull(),
  sha256: text("sha256").notNull(),
  sizeBytes: bigint("size_bytes", { mode: "number" }),
  codeSigned: boolean("code_signed").notNull().default(false),
  updaterSignature: text("updater_signature"),
  testedOn: text("tested_on"),
  notes: text("notes"),
  isPublished: boolean("is_published").notNull().default(false),
  publishedAt: ts("published_at"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const accountDeletions = pgTable("account_deletions", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  userRef: text("user_ref").notNull(),
  requestedAt: ts("requested_at").notNull(),
  completedAt: ts("completed_at").notNull().defaultNow(),
  stripeCancellation: text("stripe_cancellation"),
});
