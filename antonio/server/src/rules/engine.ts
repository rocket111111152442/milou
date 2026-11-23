import { and, eq, gte, sql } from "drizzle-orm";
import type { MailCategory } from "@antonio/shared";
import { db, schema } from "../db/client.js";
import { getProfile } from "../lib/profile.js";
import { findFreeSlots, formatDateTimeFr } from "../lib/time.js";
import { publish } from "../realtime/hub.js";
import { adapterFor } from "../connectors/registry.js";
import { withToken } from "../connectors/service.js";
import { proposeAction } from "../actions/service.js";
import { classify, extract, isMeetingRequest } from "../mail/analysis.js";
import { ruleMatches, type RuleAction, type RuleConditions } from "./match.js";

/**
 * Traitement d'un nouveau message (tâche de fond, côté serveur) :
 * 1. lecture du contenu (à la demande, non conservé intégralement) ;
 * 2. classement explicable et extraction des demandes / échéances ;
 * 3. application des règles explicites approuvées.
 * Le contenu d'un e-mail n'est jamais interprété comme une instruction.
 */
export async function processMessage(messageId: string) {
  const [msg] = await db().select().from(schema.messages).where(eq(schema.messages.id, messageId));
  if (!msg || msg.processedAt || msg.isSent) return;
  const [conn] = await db().select().from(schema.connections).where(eq(schema.connections.id, msg.connectionId));
  if (!conn || conn.status === "revoked") return;
  const profile = await getProfile(msg.userId);

  let text = msg.snippet;
  try {
    const body = await withToken(conn, (t) => adapterFor(conn.provider).getMessageBody(conn, t, msg.providerMessageId));
    text = body.text.slice(0, 8000);
  } catch {
    /* repli sur l'extrait */
  }

  const c = classify({
    fromEmail: msg.fromEmail,
    fromName: msg.fromName,
    subject: msg.subject,
    text,
    hasAttachments: msg.hasAttachments,
    ccCount: msg.ccList.length,
    priorityContacts: profile.priorityContacts.map((p) => p.email.toLowerCase()),
  });
  const extracted = extract(text, msg.receivedAt);

  // Une catégorie corrigée par l'utilisateur n'est jamais écrasée.
  const keepUserCategory = msg.categorySource === "user";
  const [claimed] = await db()
    .update(schema.messages)
    .set({
      category: keepUserCategory ? msg.category : c.category,
      categoryReason: keepUserCategory ? msg.categoryReason : c.reason,
      categorySource: keepUserCategory ? "user" : "heuristic",
      needsAction: c.needsAction,
      extracted,
      processedAt: new Date(),
    })
    .where(and(eq(schema.messages.id, msg.id), sql`${schema.messages.processedAt} IS NULL`))
    .returning();
  if (!claimed) return; // déjà traité par un autre worker (événement reçu deux fois)

  await applyRules({ ...claimed }, text);
  await publish(msg.userId, { type: "messages.changed", connectionId: msg.connectionId });
}

export async function applyRules(msg: typeof schema.messages.$inferSelect, text: string) {
  const actor = { userId: msg.userId, orgId: msg.orgId };
  const activeRules = await db()
    .select()
    .from(schema.rules)
    .where(and(eq(schema.rules.userId, msg.userId), eq(schema.rules.status, "active"), eq(schema.rules.trigger, "new_message")));
  const meetingRequest = isMeetingRequest(msg.subject, text);
  for (const rule of activeRules) {
    if (!rule.confirmedAt) continue;
    const cond = rule.conditions as RuleConditions;
    if (!ruleMatches(cond, { fromEmail: msg.fromEmail, subject: msg.subject, text, category: msg.category, meetingRequest })) continue;
    const action = rule.action as RuleAction;
    const base = { origin: "rule" as const, ruleId: rule.id, trigger: { messageId: msg.id, text }, reason: `Règle « ${rule.name} »` };
    const key = (suffix: string) => `rule:${rule.id}:msg:${msg.id}:${suffix}`;
    const reply = async (body: string, suffix: string) => {
      const subject = msg.subject.toLowerCase().startsWith("re:") ? msg.subject : `Re: ${msg.subject}`;
      return proposeAction(actor, {
        ...base,
        kind: "email.reply",
        idempotencyKey: key(suffix),
        // Destinataire contraint : uniquement l'expéditeur du message déclencheur.
        params: { connectionId: msg.connectionId, replyToMessageId: msg.id, to: [{ email: msg.fromEmail, name: msg.fromName }], cc: [], subject, body },
      });
    };
    switch (action.type) {
      case "reply_template": {
        const [tpl] = await db()
          .select()
          .from(schema.templates)
          .where(and(eq(schema.templates.id, action.templateId), eq(schema.templates.userId, msg.userId)));
        if (!tpl) continue;
        await reply(await renderTemplate(tpl.body, msg), "reply");
        break;
      }
      case "propose_slots": {
        const profile = await getProfile(msg.userId);
        const busy = await db()
          .select({ start: schema.events.startAt, end: schema.events.endAt })
          .from(schema.events)
          .where(and(eq(schema.events.userId, msg.userId), gte(schema.events.endAt, new Date()), sql`${schema.events.status} <> 'cancelled'`));
        const slots = findFreeSlots({
          from: new Date(),
          days: action.daysAhead,
          durationMin: action.durationMin,
          bufferMin: profile.meetingPrefs.bufferMin,
          prefs: profile,
          busy,
          count: action.count,
        });
        if (!slots.length) continue;
        const list = slots.map((s) => `- ${formatDateTimeFr(s.start, profile.timezone)}`).join("\n");
        const body = `Bonjour${firstName(msg.fromName) ? ` ${firstName(msg.fromName)}` : ""},\n\nMerci pour votre message. Voici quelques créneaux possibles (${action.durationMin} min) :\n${list}\n\nDites-moi celui qui vous convient et je vous envoie l'invitation.\n\n${profile.signature ?? ""}`.trim();
        await reply(body, "slots");
        break;
      }
      case "label":
        await proposeAction(actor, { ...base, kind: "email.label", idempotencyKey: key("label"), params: { connectionId: msg.connectionId, messageId: msg.id, label: action.label } });
        break;
      case "archive":
        await proposeAction(actor, { ...base, kind: "email.archive", idempotencyKey: key("archive"), params: { connectionId: msg.connectionId, messageId: msg.id } });
        break;
      case "trash":
        await proposeAction(actor, { ...base, kind: "email.trash", idempotencyKey: key("trash"), params: { connectionId: msg.connectionId, messageId: msg.id } });
        break;
      case "create_task":
        await proposeAction(actor, {
          ...base,
          kind: "task.create",
          idempotencyKey: key("task"),
          params: { title: action.title ? `${action.title} — ${msg.subject}` : `Suivre : ${msg.subject}`, notes: `De ${msg.fromName ?? msg.fromEmail}`, sourceMessageId: msg.id, dueAt: null },
        });
        break;
    }
  }
}

function firstName(name: string | null) {
  return name?.trim().split(/\s+/)[0] ?? "";
}

export async function renderTemplate(body: string, msg: { fromName: string | null; userId: string }) {
  const profile = await getProfile(msg.userId);
  return body
    .replace(/\{\{\s*prenom\s*\}\}/gi, firstName(msg.fromName))
    .replace(/\{\{\s*signature\s*\}\}/gi, profile.signature ?? "")
    .replace(/\{\{\s*mon_prenom\s*\}\}/gi, profile.firstName ?? "")
    .replace(/[ \t]+,/g, ",")
    .trim();
}

/** Correction manuelle d'une catégorie : conservée, jamais transformée en règle sans confirmation. */
export async function correctCategory(userId: string, messageId: string, category: MailCategory) {
  const r = await db()
    .update(schema.messages)
    .set({ category, categorySource: "user", categoryReason: "Corrigé par vous" })
    .where(and(eq(schema.messages.id, messageId), eq(schema.messages.userId, userId)))
    .returning();
  return r[0] ?? null;
}
