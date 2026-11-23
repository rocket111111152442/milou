import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { CATEGORIES, MAIL_CATEGORIES } from "@antonio/shared";
import { db, schema } from "../db/client.js";
import { AppError, audit, notFound } from "../lib/audit.js";
import type { Actor } from "../connectors/service.js";
import { describeAction, describeConditions, type RuleAction, type RuleConditions } from "./match.js";
import { EXCEPTION_LABELS } from "../mail/analysis.js";
import { publish } from "../realtime/hub.js";

export const conditionsSchema = z.object({
  fromEmails: z.array(z.string().email()).optional(),
  fromDomains: z.array(z.string().min(2)).optional(),
  subjectContains: z.array(z.string().min(2)).optional(),
  textContains: z.array(z.string().min(2)).optional(),
  categories: z.array(z.enum(MAIL_CATEGORIES)).optional(),
  meetingRequest: z.boolean().optional(),
});

export const actionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("reply_template"), templateId: z.string().uuid() }),
  z.object({ type: z.literal("propose_slots"), durationMin: z.number().int().min(10).max(240), daysAhead: z.number().int().min(1).max(30), count: z.number().int().min(1).max(6) }),
  z.object({ type: z.literal("label"), label: z.string().min(1).max(80) }),
  z.object({ type: z.literal("archive") }),
  z.object({ type: z.literal("trash") }),
  z.object({ type: z.literal("create_task"), title: z.string().max(200).optional() }),
]);

export const ruleInputSchema = z.object({
  name: z.string().min(2).max(120),
  conditions: conditionsSchema,
  action: actionSchema,
  /** Exceptions tolérées par la règle (« allow:amount »…). Par défaut toutes déclenchent une validation. */
  exceptions: z.array(z.string()).default([]),
  dailyLimit: z.number().int().min(1).max(200).default(20),
});
export type RuleInput = z.infer<typeof ruleInputSchema>;

const ACTION_CATEGORY: Record<RuleAction["type"], (typeof CATEGORIES)[number]> = {
  reply_template: "messages",
  propose_slots: "calendar",
  label: "filing",
  archive: "filing",
  trash: "filing",
  create_task: "tasks",
};

/**
 * Une règle est d'abord PROPOSÉE avec son périmètre et des exemples ;
 * elle ne s'applique qu'après confirmation explicite de l'utilisateur.
 */
export async function proposeRule(actor: Actor, input: RuleInput, source: "user" | "assistant" = "user") {
  const parsed = ruleInputSchema.parse(input);
  const hasCondition = Object.values(parsed.conditions).some((v) => (Array.isArray(v) ? v.length : v !== undefined));
  if (!hasCondition) throw new AppError(400, "rule_too_broad", "Une règle doit avoir au moins une condition explicite.");
  let templateName: string | null = null;
  if (parsed.action.type === "reply_template") {
    const [t] = await db()
      .select()
      .from(schema.templates)
      .where(and(eq(schema.templates.id, parsed.action.templateId), eq(schema.templates.userId, actor.userId)));
    if (!t) throw notFound("Modèle");
    templateName = t.name;
  }
  const scope = `Quand un message arrive avec : ${describeConditions(parsed.conditions as RuleConditions)} → ${describeAction(parsed.action as RuleAction, templateName)}.`;
  const allowed = parsed.exceptions.filter((e) => e.startsWith("allow:")).map((e) => e.slice(6));
  const needApproval = Object.entries(EXCEPTION_LABELS)
    .filter(([k]) => !allowed.includes(k))
    .map(([, v]) => `Message concerné avec : ${v.toLowerCase()} → préparé, envoyé seulement après votre validation`);
  const [rule] = await db()
    .insert(schema.rules)
    .values({
      orgId: actor.orgId,
      userId: actor.userId,
      name: parsed.name,
      category: ACTION_CATEGORY[parsed.action.type],
      status: "proposed",
      conditions: parsed.conditions,
      action: parsed.action,
      exceptions: parsed.exceptions,
      scopeDescription: scope,
      examplesAllowed: examplesFor(parsed.conditions as RuleConditions, parsed.action as RuleAction, templateName),
      examplesNeedApproval: [
        ...needApproval,
        "Toute catégorie réglée sur « préparation avec validation » ou « consultation »",
        `Au-delà de ${parsed.dailyLimit} exécutions par jour`,
      ],
      dailyLimit: parsed.dailyLimit,
      source,
    })
    .returning();
  return rule;
}

function examplesFor(c: RuleConditions, a: RuleAction, templateName: string | null): string[] {
  const who = c.fromEmails?.[0] ?? (c.fromDomains?.[0] ? `quelqu'un@${c.fromDomains[0].replace(/^@/, "")}` : "un expéditeur correspondant");
  const subj = c.subjectContains?.[0] ?? c.textContains?.[0] ?? (c.meetingRequest ? "demande de rendez-vous" : "message correspondant");
  return [`Message de ${who} (« ${subj} ») sans exception → ${describeAction(a, templateName)} automatiquement si la catégorie est en exécution automatique`];
}

export async function confirmRule(actor: Actor, id: string) {
  const [r] = await db()
    .update(schema.rules)
    .set({ status: "active", confirmedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(schema.rules.id, id), eq(schema.rules.userId, actor.userId)))
    .returning();
  if (!r) throw notFound("Règle");
  await audit("rule.confirmed", { orgId: actor.orgId, userId: actor.userId, meta: { ruleId: id } });
  await publish(actor.userId, { type: "ui", event: { type: "open_view", view: "rules" } }).catch(() => undefined);
  return r;
}

export async function setRuleStatus(actor: Actor, id: string, status: "active" | "paused" | "rejected") {
  const [current] = await db().select().from(schema.rules).where(and(eq(schema.rules.id, id), eq(schema.rules.userId, actor.userId)));
  if (!current) throw notFound("Règle");
  if (status === "active" && !current.confirmedAt) throw new AppError(409, "unconfirmed", "Confirmez d'abord la règle et son périmètre.");
  const [r] = await db().update(schema.rules).set({ status, updatedAt: new Date() }).where(eq(schema.rules.id, id)).returning();
  return r;
}

export async function deleteRule(actor: Actor, id: string) {
  await db().delete(schema.rules).where(and(eq(schema.rules.id, id), eq(schema.rules.userId, actor.userId)));
}

export async function listRules(actor: Actor) {
  return db().select().from(schema.rules).where(eq(schema.rules.userId, actor.userId)).orderBy(desc(schema.rules.createdAt));
}
