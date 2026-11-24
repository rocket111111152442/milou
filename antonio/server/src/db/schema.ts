import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  bigint,
  primaryKey,
  uniqueIndex,
  index,
  date,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

const id = () => uuid("id").primaryKey().default(sql`gen_random_uuid()`);
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

// ---------------------------------------------------------------------------
// Comptes, organisations, sessions
// ---------------------------------------------------------------------------

export const organizations = pgTable("organizations", {
  id: id(),
  name: text("name").notNull(),
  createdAt: createdAt(),
});

export const users = pgTable("users", {
  id: id(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  displayName: text("display_name").notNull(),
  createdAt: createdAt(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const memberships = pgTable(
  "memberships",
  {
    orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("member"), // owner | admin | member
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.orgId, t.userId] })],
);

export const sessions = pgTable(
  "sessions",
  {
    tokenHash: text("token_hash").primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

// ---------------------------------------------------------------------------
// Profil, préférences, autonomie, mémoire
// ---------------------------------------------------------------------------

export const profiles = pgTable("profiles", {
  userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  firstName: text("first_name"),
  activity: text("activity"),
  company: text("company"),
  jobRole: text("job_role"),
  professionPreset: text("profession_preset").notNull().default("generalist"),
  language: text("language").notNull().default("fr"),
  timezone: text("timezone").notNull().default("Europe/Paris"),
  workDays: jsonb("work_days").$type<number[]>().notNull().default([1, 2, 3, 4, 5]),
  workStart: text("work_start").notNull().default("09:00"),
  workEnd: text("work_end").notNull().default("18:00"),
  repetitiveTasks: jsonb("repetitive_tasks").$type<string[]>().notNull().default([]),
  priorities: jsonb("priorities").$type<string[]>().notNull().default([]),
  tools: jsonb("tools").$type<string[]>().notNull().default([]),
  tone: text("tone").notNull().default("cordial et concis"),
  tutoiement: boolean("tutoiement").notNull().default(false),
  signature: text("signature"),
  priorityContacts: jsonb("priority_contacts").$type<{ email: string; name?: string }[]>().notNull().default([]),
  meetingPrefs: jsonb("meeting_prefs")
    .$type<{ defaultDurationMin: number; bufferMin: number; preferredMode: "visio" | "phone" | "in_person"; noMeetingsBefore?: string; noMeetingsAfter?: string }>()
    .notNull()
    .default({ defaultDurationMin: 30, bufferMin: 15, preferredMode: "visio" }),
  briefingTime: text("briefing_time").notNull().default("08:30"),
  briefingContent: jsonb("briefing_content")
    .$type<{ messages: boolean; actions: boolean; approvals: boolean; agenda: boolean; priorities: boolean; errors: boolean }>()
    .notNull()
    .default({ messages: true, actions: true, approvals: true, agenda: true, priorities: true, errors: true }),
  briefingAutoSpeak: boolean("briefing_auto_speak").notNull().default(false),
  assistantName: text("assistant_name").notNull().default("Waverti"),
  assistantVoice: text("assistant_voice").notNull().default("sillage"),
  wakeWordEnabled: boolean("wake_word_enabled").notNull().default(false),
  transcriptRetentionDays: integer("transcript_retention_days").notNull().default(30),
  audioRecording: boolean("audio_recording").notNull().default(false),
  onboardingStep: text("onboarding_step"),
  onboardingCompletedAt: timestamp("onboarding_completed_at", { withTimezone: true }),
  updatedAt: updatedAt(),
});

export const subscriptions = pgTable("subscriptions", {
  userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  requestedPlan: text("requested_plan").notNull().default("essentiel"),
  plan: text("plan"),
  status: text("status").notNull().default("early_access"),
  stripeCustomerId: text("stripe_customer_id").unique(),
  stripeSubscriptionId: text("stripe_subscription_id").unique(),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
  updatedAt: updatedAt(),
});

export const integrationTokens = pgTable("integration_tokens", {
  id: id(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  createdAt: createdAt(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
});

export const billingEvents = pgTable("billing_events", {
  id: text("id").primaryKey(),
  processedAt: timestamp("processed_at", { withTimezone: true }).notNull().defaultNow(),
});

export const apiCreditLedger = pgTable(
  "api_credit_ledger",
  {
    id: id(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    amountMicros: bigint("amount_micros", { mode: "number" }).notNull(),
    kind: text("kind").notNull(), // purchase | usage
    stripeSessionId: text("stripe_session_id"),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("api_credit_stripe_session_unique").on(t.stripeSessionId),
    index("api_credit_user_created").on(t.userId, t.createdAt),
  ],
);

export const autonomy = pgTable(
  "autonomy",
  {
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    category: text("category").notNull(),
    level: text("level").notNull().default("prepare"),
    updatedAt: updatedAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.category] })],
);

/** Préférences durables, consultables, modifiables et supprimables. */
export const memories = pgTable(
  "memories",
  {
    id: id(),
    orgId: uuid("org_id").notNull(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    scope: text("scope"),
    status: text("status").notNull().default("proposed"), // proposed | active | rejected
    source: text("source").notNull().default("conversation"),
    createdAt: createdAt(),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  },
  (t) => [index("memories_user_idx").on(t.userId)],
);

// ---------------------------------------------------------------------------
// Connexions aux fournisseurs
// ---------------------------------------------------------------------------

export const connections = pgTable(
  "connections",
  {
    id: id(),
    orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(), // google | microsoft | demo
    accountEmail: text("account_email").notNull(),
    providerAccountId: text("provider_account_id"),
    status: text("status").notNull().default("active"),
    grantedScopes: jsonb("granted_scopes").$type<string[]>().notNull().default([]),
    capabilities: jsonb("capabilities").$type<string[]>().notNull().default([]),
    accessTokenEnc: text("access_token_enc"),
    refreshTokenEnc: text("refresh_token_enc"),
    tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }),
    syncState: jsonb("sync_state").$type<Record<string, unknown>>().notNull().default({}),
    webhookState: jsonb("webhook_state").$type<Record<string, unknown>>().notNull().default({}),
    lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
    lastError: text("last_error"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("connections_user_provider_account").on(t.userId, t.provider, t.accountEmail),
    index("connections_user_idx").on(t.userId),
  ],
);

export const oauthStates = pgTable("oauth_states", {
  state: text("state").primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  orgId: uuid("org_id").notNull(),
  provider: text("provider").notNull(),
  capabilities: jsonb("capabilities").$type<string[]>().notNull(),
  codeVerifier: text("code_verifier").notNull(),
  connectionId: uuid("connection_id"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: createdAt(),
});

/** Déduplication des notifications reçues (webhooks livrés « au moins une fois »). */
export const webhookReceipts = pgTable("webhook_receipts", {
  dedupeKey: text("dedupe_key").primaryKey(),
  provider: text("provider").notNull(),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Données synchronisées (métadonnées minimales ; le corps des messages est
// lu à la demande chez le fournisseur, sauf en mode démonstration)
// ---------------------------------------------------------------------------

export const messages = pgTable(
  "messages",
  {
    id: id(),
    orgId: uuid("org_id").notNull(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    connectionId: uuid("connection_id").notNull().references(() => connections.id, { onDelete: "cascade" }),
    providerMessageId: text("provider_message_id").notNull(),
    providerThreadId: text("provider_thread_id").notNull(),
    internetMessageId: text("internet_message_id"),
    fromEmail: text("from_email").notNull(),
    fromName: text("from_name"),
    toList: jsonb("to_list").$type<{ email: string; name: string | null }[]>().notNull().default([]),
    ccList: jsonb("cc_list").$type<{ email: string; name: string | null }[]>().notNull().default([]),
    subject: text("subject").notNull().default(""),
    snippet: text("snippet").notNull().default(""),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull(),
    unread: boolean("unread").notNull().default(true),
    inTrash: boolean("in_trash").notNull().default(false),
    archived: boolean("archived").notNull().default(false),
    isSent: boolean("is_sent").notNull().default(false),
    labels: jsonb("labels").$type<string[]>().notNull().default([]),
    folderId: text("folder_id"),
    hasAttachments: boolean("has_attachments").notNull().default(false),
    category: text("category").notNull().default("other"),
    categoryReason: text("category_reason"),
    categorySource: text("category_source").notNull().default("heuristic"),
    needsAction: boolean("needs_action").notNull().default(false),
    extracted: jsonb("extracted"),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("messages_conn_provider_id").on(t.connectionId, t.providerMessageId),
    index("messages_user_received").on(t.userId, t.receivedAt),
    index("messages_thread").on(t.connectionId, t.providerThreadId),
  ],
);

export const events = pgTable(
  "events",
  {
    id: id(),
    orgId: uuid("org_id").notNull(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    connectionId: uuid("connection_id").notNull().references(() => connections.id, { onDelete: "cascade" }),
    providerEventId: text("provider_event_id").notNull(),
    calendarId: text("calendar_id").notNull().default("primary"),
    title: text("title").notNull().default("(sans titre)"),
    startAt: timestamp("start_at", { withTimezone: true }).notNull(),
    endAt: timestamp("end_at", { withTimezone: true }).notNull(),
    allDay: boolean("all_day").notNull().default(false),
    timezone: text("timezone"),
    location: text("location"),
    onlineMeetingUrl: text("online_meeting_url"),
    attendees: jsonb("attendees").$type<{ email: string; name: string | null; response: string }[]>().notNull().default([]),
    organizerEmail: text("organizer_email"),
    status: text("status").notNull().default("confirmed"),
    recurring: boolean("recurring").notNull().default(false),
    showAs: text("show_as").notNull().default("busy"),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("events_conn_provider_id").on(t.connectionId, t.providerEventId),
    index("events_user_start").on(t.userId, t.startAt),
  ],
);

/** Boîte de démonstration : données fictives, jamais présentées comme réelles. */
export const demoMailbox = pgTable("demo_mailbox", {
  messageId: uuid("message_id").primaryKey().references(() => messages.id, { onDelete: "cascade" }),
  body: text("body").notNull(),
});

export const tasks = pgTable(
  "tasks",
  {
    id: id(),
    orgId: uuid("org_id").notNull(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    notes: text("notes"),
    dueAt: timestamp("due_at", { withTimezone: true }),
    status: text("status").notNull().default("open"),
    createdBy: text("created_by").notNull().default("user"),
    sourceMessageId: uuid("source_message_id"),
    actionId: uuid("action_id"),
    createdAt: createdAt(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [index("tasks_user_idx").on(t.userId, t.status)],
);

// ---------------------------------------------------------------------------
// Actions, validations, règles, modèles
// ---------------------------------------------------------------------------

export const actions = pgTable(
  "actions",
  {
    id: id(),
    orgId: uuid("org_id").notNull(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    connectionId: uuid("connection_id").references(() => connections.id, { onDelete: "set null" }),
    kind: text("kind").notNull(),
    category: text("category").notNull(),
    status: text("status").notNull().default("proposed"),
    idempotencyKey: text("idempotency_key").notNull(),
    origin: text("origin").notNull(),
    originRef: jsonb("origin_ref").$type<Record<string, unknown>>().notNull().default({}),
    ruleId: uuid("rule_id"),
    params: jsonb("params").$type<Record<string, unknown>>().notNull(),
    paramsHash: text("params_hash").notNull(),
    summary: text("summary").notNull(),
    reason: text("reason"),
    checks: jsonb("checks").$type<unknown[]>().notNull().default([]),
    providerResult: jsonb("provider_result").$type<Record<string, unknown>>(),
    reversibility: text("reversibility").notNull().default("irreversible"),
    revertInfo: jsonb("revert_info").$type<Record<string, unknown>>(),
    error: text("error"),
    attempts: integer("attempts").notNull().default(0),
    simulated: boolean("simulated").notNull().default(false),
    presentedAt: timestamp("presented_at", { withTimezone: true }),
    briefedAt: timestamp("briefed_at", { withTimezone: true }),
    executedAt: timestamp("executed_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("actions_user_idem").on(t.userId, t.idempotencyKey),
    index("actions_user_status").on(t.userId, t.status),
    index("actions_user_created").on(t.userId, t.createdAt),
  ],
);

export const actionEvents = pgTable(
  "action_events",
  {
    id: id(),
    actionId: uuid("action_id").notNull().references(() => actions.id, { onDelete: "cascade" }),
    fromStatus: text("from_status"),
    toStatus: text("to_status").notNull(),
    actor: text("actor").notNull(), // user | rule | system | worker
    note: text("note"),
    createdAt: createdAt(),
  },
  (t) => [index("action_events_action").on(t.actionId)],
);

/** Une validation porte sur une action précise ET sur l'empreinte de son contenu. */
export const approvals = pgTable("approvals", {
  id: id(),
  actionId: uuid("action_id").notNull().references(() => actions.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull(),
  paramsHash: text("params_hash").notNull(),
  decision: text("decision").notNull(), // approved | rejected
  channel: text("channel").notNull(), // ui | voice | chat
  utterance: text("utterance"),
  createdAt: createdAt(),
});

export const rules = pgTable(
  "rules",
  {
    id: id(),
    orgId: uuid("org_id").notNull(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    category: text("category").notNull(),
    status: text("status").notNull().default("proposed"), // proposed | active | paused | rejected
    trigger: text("trigger").notNull().default("new_message"),
    conditions: jsonb("conditions").$type<Record<string, unknown>>().notNull(),
    action: jsonb("action").$type<Record<string, unknown>>().notNull(),
    exceptions: jsonb("exceptions").$type<string[]>().notNull().default([]),
    scopeDescription: text("scope_description").notNull(),
    examplesAllowed: jsonb("examples_allowed").$type<string[]>().notNull().default([]),
    examplesNeedApproval: jsonb("examples_need_approval").$type<string[]>().notNull().default([]),
    dailyLimit: integer("daily_limit").notNull().default(20),
    source: text("source").notNull().default("user"),
    createdAt: createdAt(),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    updatedAt: updatedAt(),
  },
  (t) => [index("rules_user_idx").on(t.userId, t.status)],
);

export const templates = pgTable("templates", {
  id: id(),
  orgId: uuid("org_id").notNull(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  subject: text("subject"),
  body: text("body").notNull(),
  approved: boolean("approved").notNull().default(false),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

// ---------------------------------------------------------------------------
// Conversation (mémoire courte), briefings, consommation, journal
// ---------------------------------------------------------------------------

export const conversations = pgTable("conversations", {
  id: id(),
  orgId: uuid("org_id").notNull(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  channel: text("channel").notNull().default("chat"),
  createdAt: createdAt(),
  lastActivityAt: timestamp("last_activity_at", { withTimezone: true }).notNull().defaultNow(),
});

export const turns = pgTable(
  "turns",
  {
    id: id(),
    conversationId: uuid("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull(),
    role: text("role").notNull(), // user | assistant
    channel: text("channel").notNull().default("chat"),
    content: text("content").notNull(),
    uiEvents: jsonb("ui_events").$type<unknown[]>().notNull().default([]),
    toolTrace: jsonb("tool_trace").$type<unknown[]>().notNull().default([]),
    createdAt: createdAt(),
  },
  (t) => [index("turns_conv_idx").on(t.conversationId, t.createdAt)],
);

export const briefings = pgTable(
  "briefings",
  {
    id: id(),
    orgId: uuid("org_id").notNull(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    forDate: date("for_date").notNull(),
    trigger: text("trigger").notNull().default("scheduled"),
    periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
    periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
    content: jsonb("content").$type<Record<string, unknown>>().notNull(),
    createdAt: createdAt(),
    viewedAt: timestamp("viewed_at", { withTimezone: true }),
  },
  (t) => [index("briefings_user_idx").on(t.userId, t.createdAt)],
);

export const voiceSessions = pgTable("voice_sessions", {
  id: id(),
  orgId: uuid("org_id").notNull(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  providerSessionId: text("provider_session_id"),
  conversationId: uuid("conversation_id"),
  status: text("status").notNull().default("starting"), // starting | active | closed | failed
  reportedSeconds: integer("reported_seconds").notNull().default(0),
  closeReason: text("close_reason"),
  startedAt: createdAt(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
});

export const usageRecords = pgTable(
  "usage_records",
  {
    id: id(),
    orgId: uuid("org_id").notNull(),
    userId: uuid("user_id"),
    kind: text("kind").notNull(), // text_model | voice | documents | paid_tool | background
    model: text("model"),
    quantity: bigint("quantity", { mode: "number" }).notNull(),
    unit: text("unit").notNull(), // tokens_in | tokens_out | seconds | jobs | calls
    costMicros: bigint("cost_micros", { mode: "number" }).notNull().default(0),
    meta: jsonb("meta").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => [index("usage_org_created").on(t.orgId, t.createdAt), index("usage_user_created").on(t.userId, t.createdAt)],
);

export const budgets = pgTable(
  "budgets",
  {
    scopeType: text("scope_type").notNull(), // org | user
    scopeId: uuid("scope_id").notNull(),
    monthlyLimitMicros: bigint("monthly_limit_micros", { mode: "number" }).notNull().default(20_000_000),
    voiceMinutesDaily: integer("voice_minutes_daily").notNull().default(60),
    voiceSessionMaxMinutes: integer("voice_session_max_minutes").notNull().default(15),
    actionsDaily: integer("actions_daily").notNull().default(100),
    agentStepsPerTurn: integer("agent_steps_per_turn").notNull().default(8),
    alertThresholdPct: integer("alert_threshold_pct").notNull().default(80),
    updatedAt: updatedAt(),
  },
  (t) => [primaryKey({ columns: [t.scopeType, t.scopeId] })],
);

export const auditEvents = pgTable(
  "audit_events",
  {
    id: id(),
    orgId: uuid("org_id"),
    userId: uuid("user_id"),
    type: text("type").notNull(),
    meta: jsonb("meta").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => [index("audit_user_idx").on(t.userId, t.createdAt)],
);
