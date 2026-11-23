import type { FastifyInstance } from "fastify";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { AUTONOMY_LEVELS, CATEGORIES, PROFESSION_PRESETS, LIVE_VOICES } from "@antonio/shared";
import { actorOf } from "../app.js";
import { db, schema } from "../db/client.js";
import { AppError, notFound } from "../lib/audit.js";
import { allAutonomy, getProfile, setAutonomy } from "../lib/profile.js";
import { confirmRule, deleteRule, listRules, proposeRule, ruleInputSchema, setRuleStatus } from "../rules/service.js";
import { budgetStatus, effectiveBudget, setBudget } from "../usage/service.js";
import { sql } from "drizzle-orm";

const hhmm = z.string().regex(/^\d{2}:\d{2}$/);
const profilePatch = z
  .object({
    firstName: z.string().max(80),
    activity: z.string().max(200),
    company: z.string().max(200),
    jobRole: z.string().max(120),
    professionPreset: z.string().max(40),
    language: z.string().max(10),
    timezone: z.string().refine((tz) => {
      try {
        new Intl.DateTimeFormat("fr-FR", { timeZone: tz });
        return true;
      } catch {
        return false;
      }
    }, "Fuseau horaire inconnu"),
    workDays: z.array(z.number().int().min(0).max(6)),
    workStart: hhmm,
    workEnd: hhmm,
    repetitiveTasks: z.array(z.string().max(200)).max(20),
    priorities: z.array(z.string().max(200)).max(20),
    tools: z.array(z.string().max(100)).max(30),
    tone: z.string().max(200),
    tutoiement: z.boolean(),
    signature: z.string().max(1000).nullable(),
    priorityContacts: z.array(z.object({ email: z.string().email(), name: z.string().max(100).optional() })).max(100),
    meetingPrefs: z.object({
      defaultDurationMin: z.number().int().min(10).max(240),
      bufferMin: z.number().int().min(0).max(120),
      preferredMode: z.enum(["visio", "phone", "in_person"]),
      noMeetingsBefore: hhmm.optional(),
      noMeetingsAfter: hhmm.optional(),
    }),
    briefingTime: hhmm,
    briefingContent: z.object({ messages: z.boolean(), actions: z.boolean(), approvals: z.boolean(), agenda: z.boolean(), priorities: z.boolean(), errors: z.boolean() }),
    briefingAutoSpeak: z.boolean(),
    assistantName: z.string().min(1).max(40),
    assistantVoice: z.string().max(40),
    wakeWordEnabled: z.boolean(),
    transcriptRetentionDays: z.number().int().min(0).max(365),
    audioRecording: z.literal(false), // enregistrement audio durable non proposé dans cette version
    onboardingStep: z.string().max(40),
  })
  .partial();

export async function profileRoutes(app: FastifyInstance) {
  app.get("/api/presets", async () => ({ professions: PROFESSION_PRESETS, voices: LIVE_VOICES }));

  app.get("/api/profile", async (req) => {
    const u = actorOf(req);
    return { profile: await getProfile(u.userId), autonomy: await allAutonomy(u.userId) };
  });

  app.put("/api/profile", async (req) => {
    const u = actorOf(req);
    const patch = profilePatch.parse(req.body);
    const [p] = await db()
      .update(schema.profiles)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(schema.profiles.userId, u.userId))
      .returning();
    return { profile: p };
  });

  app.post("/api/onboarding/complete", async (req) => {
    const u = actorOf(req);
    await db().update(schema.profiles).set({ onboardingCompletedAt: new Date(), onboardingStep: "done" }).where(eq(schema.profiles.userId, u.userId));
    return { ok: true };
  });

  app.put("/api/autonomy", async (req) => {
    const u = actorOf(req);
    const body = z.object({ category: z.enum(CATEGORIES), level: z.enum(AUTONOMY_LEVELS) }).parse(req.body);
    await setAutonomy(u.userId, body.category, body.level);
    return { autonomy: await allAutonomy(u.userId) };
  });

  // ------------------------------------------------------------- Mémoire
  app.get("/api/memories", async (req) => {
    const u = actorOf(req);
    return { memories: await db().select().from(schema.memories).where(eq(schema.memories.userId, u.userId)).orderBy(desc(schema.memories.createdAt)) };
  });
  app.post("/api/memories", async (req) => {
    const u = actorOf(req);
    const body = z.object({ content: z.string().min(2).max(500), scope: z.string().max(200).optional() }).parse(req.body);
    const [m] = await db()
      .insert(schema.memories)
      .values({ orgId: u.orgId, userId: u.userId, content: body.content, scope: body.scope ?? null, status: "active", source: "user", confirmedAt: new Date() })
      .returning();
    return { memory: m };
  });
  app.post("/api/memories/:id/confirm", async (req) => {
    const u = actorOf(req);
    const { id } = req.params as { id: string };
    const [m] = await db()
      .update(schema.memories)
      .set({ status: "active", confirmedAt: new Date() })
      .where(and(eq(schema.memories.id, id), eq(schema.memories.userId, u.userId)))
      .returning();
    if (!m) throw notFound("Préférence");
    return { memory: m };
  });
  app.patch("/api/memories/:id", async (req) => {
    const u = actorOf(req);
    const { id } = req.params as { id: string };
    const body = z.object({ content: z.string().min(2).max(500) }).parse(req.body);
    const [m] = await db().update(schema.memories).set(body).where(and(eq(schema.memories.id, id), eq(schema.memories.userId, u.userId))).returning();
    if (!m) throw notFound("Préférence");
    return { memory: m };
  });
  app.delete("/api/memories/:id", async (req) => {
    const u = actorOf(req);
    await db().delete(schema.memories).where(and(eq(schema.memories.id, (req.params as { id: string }).id), eq(schema.memories.userId, u.userId)));
    return { ok: true };
  });

  // ------------------------------------------------------------- Modèles
  const templateBody = z.object({ name: z.string().min(1).max(120), subject: z.string().max(300).nullable().optional(), body: z.string().min(1).max(10000) });
  app.get("/api/templates", async (req) => {
    const u = actorOf(req);
    return { templates: await db().select().from(schema.templates).where(eq(schema.templates.userId, u.userId)).orderBy(desc(schema.templates.updatedAt)) };
  });
  app.post("/api/templates", async (req) => {
    const u = actorOf(req);
    const b = templateBody.parse(req.body);
    const [t] = await db()
      .insert(schema.templates)
      .values({ orgId: u.orgId, userId: u.userId, name: b.name, subject: b.subject ?? null, body: b.body, approved: false })
      .returning();
    return { template: t };
  });
  app.put("/api/templates/:id", async (req) => {
    const u = actorOf(req);
    const b = templateBody.parse(req.body);
    // Modifier un modèle retire son approbation : il doit être relu.
    const [t] = await db()
      .update(schema.templates)
      .set({ ...b, approved: false, updatedAt: new Date() })
      .where(and(eq(schema.templates.id, (req.params as { id: string }).id), eq(schema.templates.userId, u.userId)))
      .returning();
    if (!t) throw notFound("Modèle");
    return { template: t };
  });
  app.post("/api/templates/:id/approve", async (req) => {
    const u = actorOf(req);
    const body = z.object({ approved: z.boolean() }).parse(req.body);
    const [t] = await db()
      .update(schema.templates)
      .set({ approved: body.approved, updatedAt: new Date() })
      .where(and(eq(schema.templates.id, (req.params as { id: string }).id), eq(schema.templates.userId, u.userId)))
      .returning();
    if (!t) throw notFound("Modèle");
    return { template: t };
  });
  app.delete("/api/templates/:id", async (req) => {
    const u = actorOf(req);
    await db().delete(schema.templates).where(and(eq(schema.templates.id, (req.params as { id: string }).id), eq(schema.templates.userId, u.userId)));
    return { ok: true };
  });

  // ------------------------------------------------------------- Règles
  app.get("/api/rules", async (req) => ({ rules: await listRules(actorOf(req)) }));
  app.get("/api/rules/:id", async (req) => {
    const u = actorOf(req);
    const [r] = await db().select().from(schema.rules).where(and(eq(schema.rules.id, (req.params as { id: string }).id), eq(schema.rules.userId, u.userId)));
    if (!r) throw notFound("Règle");
    return { rule: r };
  });
  app.post("/api/rules", async (req) => ({ rule: await proposeRule(actorOf(req), ruleInputSchema.parse(req.body), "user") }));
  app.post("/api/rules/:id/confirm", async (req) => ({ rule: await confirmRule(actorOf(req), (req.params as { id: string }).id) }));
  app.patch("/api/rules/:id", async (req) => {
    const body = z.object({ status: z.enum(["active", "paused", "rejected"]) }).parse(req.body);
    return { rule: await setRuleStatus(actorOf(req), (req.params as { id: string }).id, body.status) };
  });
  app.delete("/api/rules/:id", async (req) => {
    await deleteRule(actorOf(req), (req.params as { id: string }).id);
    return { ok: true };
  });

  // ------------------------------------------------------------- Consommation
  app.get("/api/usage", async (req) => {
    const u = actorOf(req);
    const monthStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));
    const byKind = await db()
      .select({
        kind: schema.usageRecords.kind,
        unit: schema.usageRecords.unit,
        quantity: sql<string>`sum(${schema.usageRecords.quantity})`,
        cost: sql<string>`sum(${schema.usageRecords.costMicros})`,
      })
      .from(schema.usageRecords)
      .where(and(eq(schema.usageRecords.userId, u.userId), sql`${schema.usageRecords.createdAt} >= ${monthStart.toISOString()}::timestamptz`))
      .groupBy(schema.usageRecords.kind, schema.usageRecords.unit);
    const status = await budgetStatus(u.orgId, u.userId);
    return {
      month: monthStart.toISOString().slice(0, 7),
      byKind: byKind.map((r) => ({ kind: r.kind, unit: r.unit, quantity: Number(r.quantity), costMicros: Number(r.cost) })),
      ...status,
      role: u.role,
    };
  });
  app.put("/api/budgets", async (req) => {
    const u = actorOf(req);
    const body = z
      .object({
        scope: z.enum(["user", "org"]),
        monthlyLimitMicros: z.number().int().min(0).max(10_000_000_000).optional(),
        voiceMinutesDaily: z.number().int().min(0).max(1440).optional(),
        voiceSessionMaxMinutes: z.number().int().min(1).max(120).optional(),
        actionsDaily: z.number().int().min(0).max(5000).optional(),
        agentStepsPerTurn: z.number().int().min(1).max(20).optional(),
        alertThresholdPct: z.number().int().min(10).max(100).optional(),
      })
      .parse(req.body);
    if (body.scope === "org" && !["owner", "admin"].includes(u.role)) throw new AppError(403, "forbidden", "Seuls les administrateurs modifient le budget de l'organisation.");
    const { scope, ...values } = body;
    await setBudget(scope, scope === "org" ? u.orgId : u.userId, values);
    return { budget: await effectiveBudget(u.orgId, u.userId) };
  });
}
