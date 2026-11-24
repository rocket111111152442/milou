import "server-only";
/**
 * Server configuration read from environment variables.
 * Secrets are never exported to the client and never logged.
 */
function str(name: string, fallback = ""): string {
  const v = process.env[name];
  return v === undefined || v === null ? fallback : v.trim();
}
function int(name: string, fallback: number): number {
  const n = Number.parseInt(str(name), 10);
  return Number.isFinite(n) ? n : fallback;
}
function num(name: string, fallback: number | null): number | null {
  const raw = str(name);
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}
function list(name: string, fallback: string[]): string[] {
  const raw = str(name);
  return raw ? raw.split(",").map((s) => s.trim()).filter(Boolean) : fallback;
}

export const env = {
  siteUrl: str("NEXT_PUBLIC_SITE_URL", "http://localhost:3000").replace(/\/$/, ""),
  /** true only when the deployment is the real production site. Anything else is noindex. */
  allowIndexing: str("ALLOW_INDEXING") === "true",

  alterestate: {
    baseUrl: str("ALTERESTATE_API_BASE", "https://secure.alterestate.com/api/v1").replace(/\/$/, ""),
    publicToken: str("ALTERESTATE_PUBLIC_TOKEN"),
    /** AlterEstate company id of the agency, used to tell own listings from shared ones. */
    companyId: int("ALTERESTATE_COMPANY_ID", 2040),
    cacheSeconds: int("CATALOG_CACHE_SECONDS", 600),
    /** Max age of stale data served when AlterEstate is temporarily unavailable. */
    maxStaleSeconds: int("CATALOG_MAX_STALE_SECONDS", 6 * 3600),
  },

  database: { url: str("DATABASE_URL"), pgliteDir: str("PGLITE_DIR", ".data/pglite") },

  auth: { sessionSecret: str("SESSION_SECRET"), sessionHours: int("SESSION_HOURS", 8) },

  ai: {
    apiKeyConfigured: Boolean(str("ANTHROPIC_API_KEY") || str("ANTHROPIC_AUTH_TOKEN")),
    enabled: str("AI_ENABLED", "true") !== "false",
    model: str("AI_MODEL", "claude-opus-5-5"),
    effort: (str("AI_EFFORT", "low") as "low" | "medium" | "high"),
    maxOutputTokens: int("AI_MAX_OUTPUT_TOKENS", 1500),
    maxTurnsPerSession: int("AI_MAX_TURNS_PER_SESSION", 30),
    maxToolRounds: int("AI_MAX_TOOL_ROUNDS", 5),
    dailyMessageLimit: int("AI_DAILY_MESSAGE_LIMIT", 400),
    monthlyBudgetUsd: num("AI_MONTHLY_BUDGET_USD", 40) ?? 40,
    perIpPer10Min: int("AI_RATE_LIMIT_PER_IP_10MIN", 25),
  },

  crm: {
    priorityBudgetUsd: num("PRIORITY_BUDGET_USD", 150000) ?? 150000,
    /** DOP per USD, only used to compare DOP budgets with the priority threshold. Unset = not converted. */
    usdDopRate: num("USD_DOP_RATE", null),
    chatRetentionDays: int("CHAT_RETENTION_DAYS", 30),
    inactiveContactRetentionMonths: int("INACTIVE_CONTACT_RETENTION_MONTHS", 24),
  },

  notify: {
    /** "test" records notifications in the CRM without sending anything. "live" sends. */
    mode: (str("NOTIFY_MODE", "test") === "live" ? "live" : "test") as "live" | "test",
    events: list("NOTIFY_EVENTS", ["lead.created", "lead.hot", "visit.requested", "handoff.requested"]),
    emailTo: list("NOTIFY_EMAIL_TO", []),
    emailFrom: str("EMAIL_FROM"),
    resendApiKey: str("RESEND_API_KEY"),
    whatsapp: {
      enabled: str("WHATSAPP_NOTIFY", "false") === "true",
      token: str("WHATSAPP_CLOUD_TOKEN"),
      phoneNumberId: str("WHATSAPP_PHONE_NUMBER_ID"),
      to: str("WHATSAPP_NOTIFY_TO"),
      template: str("WHATSAPP_TEMPLATE_NAME"),
      templateLang: str("WHATSAPP_TEMPLATE_LANG", "es"),
      events: list("WHATSAPP_NOTIFY_EVENTS", ["lead.hot", "visit.requested"]),
    },
  },

  calendar: { provider: str("CALENDAR_PROVIDER", "none") },
  cronSecret: str("CRON_SECRET"),
};

export const catalogMode = (): "live" | "demo" => (env.alterestate.publicToken ? "live" : "demo");

/** The CRM needs a persistent database: PostgreSQL in production, PGlite locally. */
export const crmStorageConfigured = (): boolean =>
  Boolean(env.database.url) || process.env.NODE_ENV !== "production" || process.env.ALLOW_PGLITE_IN_PRODUCTION === "true";
