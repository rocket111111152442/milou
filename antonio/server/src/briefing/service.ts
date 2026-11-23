import { and, desc, eq, gte, inArray, isNull, lte, sql } from "drizzle-orm";
import type { BriefingDTO, BriefingItem, Extracted } from "@antonio/shared";
import { db, schema } from "../db/client.js";
import { getProfile } from "../lib/profile.js";
import { addDaysLocal, formatDateTimeFr, formatTimeFr, localDateString, parseHHMM, startOfLocalDay, zonedParts } from "../lib/time.js";
import { publish } from "../realtime/hub.js";
import type { Actor } from "../connectors/service.js";
import { awaitingReplies } from "../mail/data.js";

/**
 * Point quotidien construit UNIQUEMENT à partir des données récupérées :
 *  - « observed » : ce qui a été constaté (messages, rendez-vous) ;
 *  - « done » : actions dont le fournisseur a confirmé le succès ;
 *  - « pending » : ce qui attend une décision ;
 *  - « recommendation » : propositions, présentées comme telles ;
 *  - « error » : échecs, résultats incertains, connexions à rétablir.
 * Une action déjà présentée n'est pas répétée comme nouvelle (briefed_at).
 */
export async function generateBriefing(actor: Actor, trigger: "scheduled" | "on_demand"): Promise<BriefingDTO> {
  const profile = await getProfile(actor.userId);
  const tz = profile.timezone;
  const now = new Date();
  const [last] = await db()
    .select()
    .from(schema.briefings)
    .where(eq(schema.briefings.userId, actor.userId))
    .orderBy(desc(schema.briefings.createdAt))
    .limit(1);
  const periodStart = last ? last.periodEnd : new Date(now.getTime() - 24 * 3600_000);
  const fmt = (d: Date) => formatDateTimeFr(d, tz);

  // Messages importants reçus pendant la période.
  const msgs = await db()
    .select()
    .from(schema.messages)
    .where(
      and(
        eq(schema.messages.userId, actor.userId),
        eq(schema.messages.orgId, actor.orgId),
        eq(schema.messages.isSent, false),
        eq(schema.messages.inTrash, false),
        gte(schema.messages.receivedAt, periodStart),
      ),
    )
    .orderBy(desc(schema.messages.receivedAt))
    .limit(100);
  const priority = new Set(profile.priorityContacts.map((c) => c.email.toLowerCase()));
  const important = msgs.filter((m) => m.category === "to_handle" || priority.has(m.fromEmail));
  const importantMessages: BriefingItem[] = important.slice(0, 8).map((m) => ({
    kind: "observed",
    text: `${m.fromName ?? m.fromEmail} — « ${m.subject} »${m.needsAction ? " (demande à traiter)" : ""}`,
    source: { type: "message", id: m.id },
  }));
  const others = msgs.length - important.length;
  if (others > 0) importantMessages.push({ kind: "observed", text: `${others} autre(s) message(s) moins prioritaire(s) (newsletters, notifications, informations).` });

  // Actions réellement accomplies (confirmées par le fournisseur), non encore présentées.
  const done = await db()
    .select()
    .from(schema.actions)
    .where(and(eq(schema.actions.userId, actor.userId), eq(schema.actions.status, "succeeded"), isNull(schema.actions.briefedAt)))
    .orderBy(desc(schema.actions.completedAt))
    .limit(30);
  const actionsDone: BriefingItem[] = done.map((a) => ({
    kind: "done",
    text: `${a.summary}${a.simulated ? " (simulé — démonstration)" : ""}${a.origin === "rule" ? " — automatiquement, selon une règle" : ""}`,
    source: { type: "action", id: a.id },
  }));

  // En attente de décision.
  const pending = await db()
    .select()
    .from(schema.actions)
    .where(and(eq(schema.actions.userId, actor.userId), eq(schema.actions.status, "awaiting_approval")))
    .orderBy(desc(schema.actions.createdAt))
    .limit(20);
  const toValidate: BriefingItem[] = pending.map((a) => ({ kind: "pending", text: `${a.summary} — ${a.reason ?? ""}`.trim(), source: { type: "action", id: a.id } }));

  // Agenda du jour et échéances proches.
  const dayStart = startOfLocalDay(now, tz);
  const dayEnd = addDaysLocal(dayStart, 1, tz);
  const events = await db()
    .select()
    .from(schema.events)
    .where(and(eq(schema.events.userId, actor.userId), lte(schema.events.startAt, dayEnd), gte(schema.events.endAt, dayStart), sql`${schema.events.status} <> 'cancelled'`))
    .orderBy(schema.events.startAt);
  const agenda: BriefingItem[] = events.map((e) => {
    const pendingAnswers = e.attendees.filter((a) => a.response === "needsAction").length;
    return {
      kind: "observed",
      text: `${formatTimeFr(e.startAt, tz)} — ${e.title}${e.location ? ` (${e.location})` : ""}${pendingAnswers ? ` · ${pendingAnswers} participant(s) n'ont pas encore répondu` : ""}`,
      source: { type: "event", id: e.id },
    };
  });
  const soon = localDateString(addDaysLocal(now, 3, tz), tz);
  const today = localDateString(now, tz);
  const withDeadlines = await db()
    .select()
    .from(schema.messages)
    .where(and(eq(schema.messages.userId, actor.userId), eq(schema.messages.inTrash, false), sql`${schema.messages.extracted} IS NOT NULL`, gte(schema.messages.receivedAt, new Date(now.getTime() - 14 * 86400_000))));
  for (const m of withDeadlines) {
    for (const d of (m.extracted as Extracted).deadlines) {
      if (d.date && d.date >= today && d.date <= soon) {
        agenda.push({
          kind: "observed",
          text: `Échéance ${d.certainty === "certain" ? "" : "(déduite) "}le ${d.date} — « ${m.subject} » : ${d.text}`,
          source: { type: "message", id: m.id },
        });
      }
    }
  }
  const dueTasks = await db()
    .select()
    .from(schema.tasks)
    .where(and(eq(schema.tasks.userId, actor.userId), eq(schema.tasks.status, "open"), lte(schema.tasks.dueAt, dayEnd)));
  for (const t of dueTasks) agenda.push({ kind: "observed", text: `Tâche à échéance : ${t.title}`, source: { type: "task", id: t.id } });

  // Erreurs et connexions à rétablir.
  const errorsRows = await db()
    .select()
    .from(schema.actions)
    .where(and(eq(schema.actions.userId, actor.userId), inArray(schema.actions.status, ["failed", "uncertain"]), gte(schema.actions.updatedAt, periodStart)))
    .limit(20);
  const errors: BriefingItem[] = errorsRows.map((a) => ({
    kind: "error",
    text: `${a.status === "uncertain" ? "Résultat incertain, vérification en cours" : "Échec"} : ${a.summary}${a.error ? ` — ${a.error}` : ""}`,
    source: { type: "action", id: a.id },
  }));
  const conns = await db().select().from(schema.connections).where(eq(schema.connections.userId, actor.userId));
  for (const c of conns.filter((c) => c.status === "expired" || c.status === "error")) {
    errors.push({ kind: "error", text: `Connexion ${c.accountEmail} à rétablir : ${c.lastError ?? c.status}`, source: { type: "connection", id: c.id } });
  }

  // Recommandations (présentées comme des propositions).
  const priorities: BriefingItem[] = [];
  if (pending.length) priorities.push({ kind: "recommendation", text: `Valider ou refuser les ${pending.length} action(s) préparée(s).` });
  const fromPriority = important.filter((m) => priority.has(m.fromEmail));
  for (const m of fromPriority.slice(0, 2)) priorities.push({ kind: "recommendation", text: `Répondre à ${m.fromName ?? m.fromEmail} (contact prioritaire).`, source: { type: "message", id: m.id } });
  const waiting = await awaitingReplies(actor, 3);
  if (waiting.length) priorities.push({ kind: "recommendation", text: `${waiting.length} dossier(s) sans réponse depuis plus de 3 jours : envisager une relance.` });
  const firstNeeds = important.find((m) => m.needsAction && !priority.has(m.fromEmail));
  if (firstNeeds) priorities.push({ kind: "recommendation", text: `Traiter la demande de ${firstNeeds.fromName ?? firstNeeds.fromEmail} : « ${firstNeeds.subject} ».`, source: { type: "message", id: firstNeeds.id } });
  if (errors.length) priorities.push({ kind: "recommendation", text: "Régler les erreurs ou connexions signalées." });

  const simulatedData = conns.some((c) => c.provider === "demo" && c.status === "active");
  const content = filterSections(profile.briefingContent, { importantMessages, actionsDone, toValidate, agenda, priorities, errors });
  const spoken = speak(profile.firstName, profile.assistantName, periodStart, now, tz, content, simulatedData);

  const [row] = await db()
    .insert(schema.briefings)
    .values({ orgId: actor.orgId, userId: actor.userId, forDate: today, trigger, periodStart, periodEnd: now, content: { sections: content, spoken, simulatedData } })
    .returning();
  if (done.length) {
    await db().update(schema.actions).set({ briefedAt: now }).where(inArray(schema.actions.id, done.map((d) => d.id)));
  }
  await publish(actor.userId, { type: "briefing.ready", briefingId: row.id });
  return toBriefingDTO(row);

  function _unused() {
    return fmt;
  }
}

function filterSections(prefs: { messages: boolean; actions: boolean; approvals: boolean; agenda: boolean; priorities: boolean; errors: boolean }, s: BriefingDTO["sections"]): BriefingDTO["sections"] {
  return {
    importantMessages: prefs.messages ? s.importantMessages : [],
    actionsDone: prefs.actions ? s.actionsDone : [],
    toValidate: prefs.approvals ? s.toValidate : [],
    agenda: prefs.agenda ? s.agenda : [],
    priorities: prefs.priorities ? s.priorities : [],
    errors: prefs.errors ? s.errors : [],
  };
}

function speak(firstName: string | null, assistant: string, from: Date, to: Date, tz: string, s: BriefingDTO["sections"], demo: boolean): string {
  const parts: string[] = [];
  parts.push(`Bonjour${firstName ? ` ${firstName}` : ""}. Voici le point depuis ${formatDateTimeFr(from, tz)}.`);
  if (demo) parts.push("Attention : une partie des données provient du compte de démonstration, elles sont fictives.");
  const nImp = s.importantMessages.filter((i) => i.source).length;
  parts.push(nImp ? `${nImp} message${nImp > 1 ? "s" : ""} important${nImp > 1 ? "s" : ""}, dont ${s.importantMessages[0].text}.` : "Aucun nouveau message important.");
  parts.push(
    s.actionsDone.length
      ? `J'ai effectué ${s.actionsDone.length} action${s.actionsDone.length > 1 ? "s" : ""} confirmée${s.actionsDone.length > 1 ? "s" : ""} par vos outils.`
      : "Je n'ai exécuté aucune nouvelle action depuis le dernier point.",
  );
  if (s.toValidate.length) parts.push(`${s.toValidate.length} élément${s.toValidate.length > 1 ? "s attendent" : " attend"} votre validation.`);
  const evs = s.agenda.filter((a) => a.source?.type === "event");
  parts.push(evs.length ? `Aujourd'hui, ${evs.length} rendez-vous : ${evs.map((e) => e.text).slice(0, 3).join(" ; ")}.` : "Aucun rendez-vous aujourd'hui.");
  if (s.errors.length) parts.push(`${s.errors.length} point${s.errors.length > 1 ? "s" : ""} à régler : ${s.errors[0].text}.`);
  if (s.priorities.length) parts.push(`Je vous propose de commencer par : ${s.priorities[0].text}`);
  void assistant;
  return parts.join(" ");
}

export function toBriefingDTO(row: typeof schema.briefings.$inferSelect): BriefingDTO {
  const c = row.content as { sections: BriefingDTO["sections"]; spoken: string; simulatedData: boolean };
  return {
    id: row.id,
    periodStart: row.periodStart.toISOString(),
    periodEnd: row.periodEnd.toISOString(),
    generatedAt: row.createdAt.toISOString(),
    sections: c.sections,
    spoken: c.spoken,
    simulatedData: c.simulatedData,
  };
}

export async function latestBriefing(actor: Actor) {
  const [row] = await db()
    .select()
    .from(schema.briefings)
    .where(and(eq(schema.briefings.userId, actor.userId), eq(schema.briefings.orgId, actor.orgId)))
    .orderBy(desc(schema.briefings.createdAt))
    .limit(1);
  return row ? toBriefingDTO(row) : null;
}

/** Tâche planifiée : prépare le point à l'heure choisie, dans le fuseau de l'utilisateur. */
export async function briefingTick(now = new Date()) {
  const profiles = await db().select().from(schema.profiles).where(sql`${schema.profiles.onboardingCompletedAt} IS NOT NULL`);
  for (const p of profiles) {
    const local = zonedParts(now, p.timezone);
    const { h, m } = parseHHMM(p.briefingTime);
    if (local.hour * 60 + local.minute < h * 60 + m) continue;
    const date = localDateString(now, p.timezone);
    const [exists] = await db()
      .select({ id: schema.briefings.id })
      .from(schema.briefings)
      .where(and(eq(schema.briefings.userId, p.userId), eq(schema.briefings.forDate, date), eq(schema.briefings.trigger, "scheduled")));
    if (exists) continue;
    await generateBriefing({ userId: p.userId, orgId: p.orgId }, "scheduled").catch((e) => console.error("[briefing]", (e as Error).message));
  }
}
