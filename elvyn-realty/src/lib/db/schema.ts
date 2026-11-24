import { pgTable, text, timestamp, integer, boolean, jsonb, uuid, serial, index, uniqueIndex, date, real } from "drizzle-orm/pg-core";

export const adminUsers = pgTable("admin_users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
}, (t) => [uniqueIndex("admin_users_email_idx").on(t.email)]);

/** Criteria a prospect gave (search or property offered). All optional. */
export interface Criteria {
  intent?: "buy" | "rent" | "sell" | "other";
  propertyTypes?: string[];
  zones?: string[];
  budgetMin?: number | null;
  budgetMax?: number | null;
  currency?: string | null;
  paymentMethod?: string | null; // contado / banco / cuotas / proyecto
  usage?: string | null; // vivienda / vacacional / inversión / renta
  timeline?: string | null;
  bedrooms?: number | null;
  mustHaves?: string[];
  visitPreference?: "physical" | "virtual" | null;
  availability?: string | null;
  // sellers
  titleDeslindado?: string | null;
  hasMortgage?: string | null;
  expectedPrice?: number | null;
  // vacation rentals
  guests?: number | null;
  dates?: string | null;
  multipleUnits?: boolean | null;
}

export const contacts = pgTable("contacts", {
  id: serial("id").primaryKey(),
  fullName: text("full_name").notNull(),
  email: text("email"),
  phone: text("phone"), // normalised E.164
  country: text("country"),
  city: text("city"),
  language: text("language"),
  birthDate: date("birth_date"), // optional, only editable by Elvyn; never asked by the assistant
  howFound: text("how_found"),
  source: text("source").notNull(), // web_form | chat | sell_form | visit_form | manual
  status: text("status").notNull().default("nuevo"),
  temperature: text("temperature").notNull().default("frio"), // caliente | tibio | frio
  temperatureReason: text("temperature_reason"),
  temperatureManual: boolean("temperature_manual").notNull().default(false),
  priority: boolean("priority").notNull().default(false),
  priorityReason: text("priority_reason"),
  criteria: jsonb("criteria").$type<Criteria>().notNull().default({}),
  summary: text("summary"),
  nextAction: text("next_action"),
  nextActionAt: timestamp("next_action_at", { withTimezone: true }),
  consentAt: timestamp("consent_at", { withTimezone: true }),
  lastActivityAt: timestamp("last_activity_at", { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index("contacts_email_idx").on(t.email),
  index("contacts_phone_idx").on(t.phone),
  index("contacts_status_idx").on(t.status),
  index("contacts_created_idx").on(t.createdAt),
]);

/** Every request a contact sends (form, chat hand-off, visit request). History is append-only. */
export const inquiries = pgTable("inquiries", {
  id: serial("id").primaryKey(),
  contactId: integer("contact_id").notNull().references(() => contacts.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(), // contact | property | visit | sell | chat_handoff
  channel: text("channel").notNull(), // web_form | chat
  reason: text("reason"), // hand-off reason from the assistant
  propertySlug: text("property_slug"),
  propertyRef: text("property_ref"),
  propertyTitle: text("property_title"),
  message: text("message"),
  summary: text("summary"),
  criteria: jsonb("criteria").$type<Criteria>(),
  chatSessionId: uuid("chat_session_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [index("inquiries_contact_idx").on(t.contactId)]);

export const appointments = pgTable("appointments", {
  id: serial("id").primaryKey(),
  contactId: integer("contact_id").notNull().references(() => contacts.id, { onDelete: "cascade" }),
  inquiryId: integer("inquiry_id").references(() => inquiries.id, { onDelete: "set null" }),
  propertySlug: text("property_slug"),
  propertyRef: text("property_ref"),
  propertyTitle: text("property_title"),
  type: text("type").notNull(), // physical | virtual
  timezone: text("timezone"),
  preferredSlots: jsonb("preferred_slots").$type<string[]>().notNull().default([]),
  status: text("status").notNull().default("solicitada"), // solicitada | confirmada | cancelada | realizada | no_asistio
  startsAt: timestamp("starts_at", { withTimezone: true }),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  meetingUrl: text("meeting_url"),
  outcome: text("outcome"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [index("appointments_status_idx").on(t.status), index("appointments_starts_idx").on(t.startsAt)]);

export const notes = pgTable("notes", {
  id: serial("id").primaryKey(),
  contactId: integer("contact_id").notNull().references(() => contacts.id, { onDelete: "cascade" }),
  authorId: integer("author_id").references(() => adminUsers.id, { onDelete: "set null" }),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const activities = pgTable("activities", {
  id: serial("id").primaryKey(),
  contactId: integer("contact_id").notNull().references(() => contacts.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  data: jsonb("data").$type<Record<string, unknown>>().notNull().default({}),
  actorId: integer("actor_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [index("activities_contact_idx").on(t.contactId)]);

/** Assistant conversations. `profile` holds what the visitor shared; nothing reaches the CRM without their confirmation. */
export const chatSessions = pgTable("chat_sessions", {
  id: uuid("id").primaryKey(),
  lang: text("lang").notNull(),
  propertySlug: text("property_slug"),
  profile: jsonb("profile").$type<Record<string, unknown>>().notNull().default({}),
  seenSlugs: jsonb("seen_slugs").$type<string[]>().notNull().default([]),
  handoff: jsonb("handoff").$type<Record<string, unknown> | null>(),
  contactId: integer("contact_id").references(() => contacts.id, { onDelete: "set null" }),
  userTurns: integer("user_turns").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [index("chat_sessions_updated_idx").on(t.updatedAt)]);

/** Raw model transcript (append-only, replayed verbatim to the model) and what the visitor saw. */
export const chatMessages = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  sessionId: uuid("session_id").notNull().references(() => chatSessions.id, { onDelete: "cascade" }),
  seq: integer("seq").notNull(),
  role: text("role").notNull(), // user | assistant | system
  content: jsonb("content").notNull(),
  display: jsonb("display").$type<Record<string, unknown> | null>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [uniqueIndex("chat_messages_seq_idx").on(t.sessionId, t.seq)]);

export const aiUsage = pgTable("ai_usage", {
  id: serial("id").primaryKey(),
  day: date("day").notNull(),
  sessionId: uuid("session_id"),
  model: text("model").notNull(),
  inputTokens: integer("input_tokens").notNull().default(0),
  outputTokens: integer("output_tokens").notNull().default(0),
  cacheReadTokens: integer("cache_read_tokens").notNull().default(0),
  cacheWriteTokens: integer("cache_write_tokens").notNull().default(0),
  costUsd: real("cost_usd").notNull().default(0),
  outcome: text("outcome").notNull(), // ok | refusal | error | limit
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [index("ai_usage_day_idx").on(t.day)]);

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  idempotencyKey: text("idempotency_key").notNull(),
  event: text("event").notNull(),
  channel: text("channel").notNull(), // email | whatsapp
  recipient: text("recipient").notNull(),
  subject: text("subject"),
  body: text("body").notNull(),
  contactId: integer("contact_id").references(() => contacts.id, { onDelete: "cascade" }),
  status: text("status").notNull(), // test | pending | sent | failed | skipped
  attempts: integer("attempts").notNull().default(0),
  lastError: text("last_error"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  sentAt: timestamp("sent_at", { withTimezone: true }),
}, (t) => [uniqueIndex("notifications_key_idx").on(t.idempotencyKey)]);
