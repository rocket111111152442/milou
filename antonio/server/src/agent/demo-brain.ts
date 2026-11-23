import { and, desc, eq } from "drizzle-orm";
import type { UIEvent } from "@antonio/shared";
import { db, schema } from "../db/client.js";
import { getProfile } from "../lib/profile.js";
import { addDaysLocal, localDateString } from "../lib/time.js";
import { runTool, type ToolContext, type ToolResult } from "./tools.js";
import type { TurnTrace } from "./orchestrator.js";

/**
 * Moteur de commandes SANS IA (aucun appel au modèle) :
 * utilisé quand OPENAI_API_KEY est absente, quand le budget est atteint ou
 * quand le service IA est indisponible. Il passe par les MÊMES outils et la
 * MÊME politique serveur que le modèle ; seule la compréhension est limitée.
 */

const N = (s: string) => s.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
const NUMBERS: Record<string, number> = { un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, dix: 10 };

export async function demoBrain(text: string, ctx: ToolContext, prev: TurnTrace | null, trace: TurnTrace, ui: UIEvent[]): Promise<string> {
  const t = N(text);
  const profile = await getProfile(ctx.actor.userId);
  const call = async (name: string, args: Record<string, unknown>): Promise<ToolResult> => {
    const r = await runTool(name, args, ctx);
    ui.push(...r.ui);
    trace.actionIds.push(...r.actionIds);
    trace.ruleIds.push(...(r.ruleIds ?? []));
    trace.memoryIds.push(...(r.memoryIds ?? []));
    trace.tools.push({ name, ok: !(r.output as { error?: string })?.error });
    for (const ev of r.ui) {
      if (ev.type === "focus_message") trace.focus.messageId = ev.id;
      if (ev.type === "focus_action") trace.focus.actionId = ev.id;
    }
    return r;
  };
  const focusMessage = prev?.focus.messageId ?? (await lastFocusedMessage(ctx));
  const focusAction = prev?.focus.actionId ?? null;
  if (focusMessage && !trace.focus.messageId) trace.focus.messageId = focusMessage;

  // Validation / refus de l'élément présenté juste avant.
  if (/^(oui|ok|vas-y|valide|envoie|d'accord|c'est bon|confirme|approuve|parfait)\b/.test(t) && (prev?.actionIds.length || prev?.ruleIds.length)) {
    if (prev?.ruleIds.length) {
      const r = await call("confirm_rule", { rule_id: prev.ruleIds[0] });
      return (r.output as { error?: string }).error ?? "Règle confirmée et activée. Elle s'appliquera aux prochains messages correspondants, avec validation dès qu'une exception apparaît.";
    }
    const id = prev!.focus.actionId ?? prev!.actionIds[0];
    const r = await call("approve_action", { action_id: id });
    return describeOutcome(r.output, "validée");
  }
  if (/^(non|annule|refuse|laisse tomber)\b/.test(t) && focusAction) {
    await call("reject_action", { action_id: focusAction });
    return "D'accord, j'ai annulé cette action. Rien n'a été envoyé.";
  }

  if (/(fais.?moi le point|point sur (ma|la) journee|briefing|resume de (ma|la) journee|quoi de neuf)/.test(t)) {
    const r = await call("get_briefing", {});
    return (r.output as { spoken_summary: string }).spoken_summary;
  }

  const waiting = t.match(/attend\w* (une )?reponse depuis (\d+|un|une|deux|trois|quatre|cinq|six|sept|huit|dix) jours?/);
  if (waiting) {
    const days = Number(waiting[2]) || NUMBERS[waiting[2]] || 3;
    const r = await call("awaiting_replies", { days });
    const n = (r.output as { count: number }).count;
    return n ? `${n} dossier${n > 1 ? "s attendent" : " attend"} une réponse depuis au moins ${days} jours. Je les affiche.` : `Aucun dossier n'attend de réponse depuis ${days} jours.`;
  }

  if (/pourquoi/.test(t) && focusAction) {
    const r = await call("explain_action", { action_id: focusAction });
    const o = r.output as { reason: string; origin: string; rule: string | null; checks: { ok: boolean; label: string; detail?: string }[] };
    const failing = o.checks.filter((c) => !c.ok);
    return `Origine : ${o.origin === "rule" ? `la règle « ${o.rule} »` : "votre demande"}. ${o.reason ?? ""}${failing.length ? ` Points à vérifier : ${failing.map((f) => f.detail ?? f.label).join(" ; ")}.` : ""}`;
  }

  if (/(plus court|plus courte|raccourci)/.test(t) && focusAction) {
    const [a] = await db().select().from(schema.actions).where(eq(schema.actions.id, focusAction));
    if (a?.params.body) {
      const body = shorten(a.params.body as string, profile.signature);
      const r = await call("edit_pending_action", { action_id: focusAction, body });
      return describeOutcome(r.output, "raccourcie");
    }
  }

  const slotAsk = t.match(/(propose|trouve|cherche).*(creneau|creneaux|rendez-vous|disponibilit)/);
  if (slotAsk) {
    const weekday = ["lundi", "mardi", "mercredi", "jeudi", "vendredi"].find((d) => t.includes(d));
    const part = t.includes("apres-midi") ? "afternoon" : t.includes("matin") ? "morning" : "any";
    const slotsR = await call("find_free_slots", { duration_min: profile.meetingPrefs.defaultDurationMin * (t.includes("une heure") || t.includes("1h") ? 2 : 1), days_ahead: 10, weekday, part_of_day: part, count: 3 });
    const slots = (slotsR.output as { slots: { label: string }[] }).slots;
    if (!slots.length) return "Je ne trouve aucun créneau libre correspondant dans vos horaires de travail.";
    if (focusMessage && /(lui|propose-lui|repond)/.test(t)) {
      const [m] = await db().select().from(schema.messages).where(and(eq(schema.messages.id, focusMessage), eq(schema.messages.userId, ctx.actor.userId)));
      const first = m?.fromName?.split(" ")[0] ?? "";
      const body = `Bonjour${first ? ` ${first}` : ""},\n\nJe vous propose les créneaux suivants :\n${slots.map((s) => `- ${s.label}`).join("\n")}\n\nDites-moi celui qui vous convient et je vous envoie l'invitation.`;
      const r = await call("prepare_reply", { message_id: focusMessage, body });
      return `J'ai trouvé ${slots.length} créneaux (rien n'est réservé). ${describeOutcome(r.output, "préparée")}`;
    }
    return `Voici ${slots.length} créneaux libres : ${slots.map((s) => s.label).join(" ; ")}. Rien n'est réservé.`;
  }

  if (/(prepare|redige|ecris).*(reponse|repondre)|reponds/.test(t) && focusMessage) {
    const [m] = await db().select().from(schema.messages).where(and(eq(schema.messages.id, focusMessage), eq(schema.messages.userId, ctx.actor.userId)));
    const first = m?.fromName?.split(" ")[0] ?? "";
    const body = `Bonjour${first ? ` ${first}` : ""},\n\nMerci pour votre message. Je reviens vers vous très rapidement avec une réponse complète.\n\nBien cordialement,`;
    const r = await call("prepare_reply", { message_id: focusMessage, body });
    return describeOutcome(r.output, "préparée");
  }

  if (/(applique|retiens|garde).*(regle|a l'avenir|prochaines|similaires)/.test(t)) {
    const [m] = focusMessage ? await db().select().from(schema.messages).where(eq(schema.messages.id, focusMessage)) : [];
    if (!m) return "Pour proposer une règle, ouvrez d'abord un message exemple, ou créez-la dans la vue Règles.";
    const isMeeting = /rendez-vous|creneau|point|appel|disponib/.test(N(`${m.subject} ${m.snippet}`));
    const domain = m.fromEmail.split("@")[1];
    const r = await call("propose_rule", {
      name: isMeeting ? `Proposer des créneaux — ${domain}` : `Tâche de suivi — ${domain}`,
      conditions: { fromDomains: [domain], ...(isMeeting ? { meetingRequest: true } : {}) },
      action: isMeeting ? { type: "propose_slots", durationMin: profile.meetingPrefs.defaultDurationMin, daysAhead: 7, count: 3 } : { type: "create_task" },
    });
    const o = r.output as { scope?: string; error?: string };
    return o.error ?? `Je propose cette règle : ${o.scope} Elle restera inactive tant que vous ne l'aurez pas confirmée. Voulez-vous l'activer ?`;
  }

  if (/(corbeille|supprime)/.test(t) && focusMessage) {
    const r = await call("file_message", { message_id: focusMessage, operation: "trash" });
    return describeOutcome(r.output, "mise à la corbeille");
  }
  if (/(restaure|recupere)/.test(t) && focusMessage) {
    const r = await call("file_message", { message_id: focusMessage, operation: "restore" });
    return describeOutcome(r.output, "restauration");
  }
  if (/archive/.test(t) && focusMessage) {
    const r = await call("file_message", { message_id: focusMessage, operation: "archive" });
    return describeOutcome(r.output, "archivage");
  }
  if (/(cree|ajoute).*(tache)/.test(t)) {
    const title = text.replace(/.*t[âa]che\s*(:|pour|de)?\s*/i, "").trim() || "Suivi";
    const r = await call("create_task", { title, message_id: focusMessage ?? undefined });
    return describeOutcome(r.output, "créée");
  }

  if (/(rendez-vous|agenda|reunion|planning|rdv)/.test(t)) {
    const now = new Date();
    const start = t.includes("demain") ? addDaysLocal(now, 1, profile.timezone) : now;
    const end = t.includes("semaine") ? addDaysLocal(now, 6, profile.timezone) : start;
    const r = await call("list_events", { from_date: localDateString(start, profile.timezone), to_date: localDateString(end, profile.timezone) });
    const o = r.output as { count: number; events: { title: string; start: string }[] };
    return o.count ? `Vous avez ${o.count} rendez-vous : ${o.events.map((e) => `${e.start}, ${e.title}`).join(" ; ")}.` : "Aucun rendez-vous sur cette période.";
  }

  const mailOf = text.match(/(?:mail|message|e-mail|courriel)s? (?:de|d')\s*([\p{L}' .-]+?)\s*[?.!]*$/iu);
  if (mailOf) {
    const r = await call("search_messages", { from: mailOf[1].trim() });
    const o = r.output as { count: number; messages: { id: string; subject: string; from: string }[] };
    if (!o.count) return `Je ne trouve aucun message de ${mailOf[1].trim()}.`;
    await call("open_message", { message_id: o.messages[0].id });
    return `Voici le message de ${o.messages[0].from} : « ${o.messages[0].subject} ».`;
  }

  if (/(mails?|messages?|boite|courriels?)/.test(t)) {
    const r = await call("search_messages", { needs_action: t.includes("traiter") || t.includes("important") ? true : undefined, days: 7 });
    const o = r.output as { count: number };
    return o.count ? `${o.count} message${o.count > 1 ? "s" : ""} récent${o.count > 1 ? "s" : ""} affiché${o.count > 1 ? "s" : ""}.` : "Aucun message récent.";
  }

  if (/(valider|validation|en attente)/.test(t)) {
    const r = await call("list_pending_approvals", {});
    const n = (r.output as { count: number }).count;
    return n ? `${n} action${n > 1 ? "s attendent" : " attend"} votre validation.` : "Rien n'attend votre validation.";
  }
  if (/(historique|qu'as-tu fait|qu'est-ce que tu as fait)/.test(t)) {
    await call("list_history", { days: 7 });
    return "Voici l'historique des actions de la semaine.";
  }

  return "En mode commandes simples, je comprends par exemple : « fais-moi le point », « montre-moi mes mails », « montre-moi le mail de Sophie », « prépare une réponse », « propose-lui un créneau jeudi après-midi », « quels dossiers attendent une réponse depuis trois jours ? », « montre-moi mes rendez-vous », « oui » / « non » pour valider.";
}

async function lastFocusedMessage(ctx: ToolContext): Promise<string | null> {
  const turns = await db()
    .select()
    .from(schema.turns)
    .where(and(eq(schema.turns.conversationId, ctx.conversationId), eq(schema.turns.role, "assistant")))
    .orderBy(desc(schema.turns.createdAt))
    .limit(6);
  for (const t of turns) {
    const tr = (t.toolTrace?.[0] as TurnTrace | undefined)?.focus.messageId;
    if (tr) return tr;
  }
  return null;
}

function shorten(body: string, signature: string | null): string {
  const withoutSig = signature ? body.replace(signature, "").trim() : body;
  const lines = withoutSig.split("\n").filter((l) => l.trim());
  const greeting = lines[0] ?? "Bonjour,";
  const core = lines.slice(1, 3).join(" ");
  return `${greeting}\n\n${core}`.trim();
}

function describeOutcome(output: unknown, verb: string): string {
  const o = output as { error?: string; status?: string; summary?: string; simulated?: boolean; failing_checks?: string[]; reason?: string };
  if (o.error) return `Je n'ai pas pu continuer : ${o.error}${o.failing_checks?.length ? ` (${o.failing_checks.join(" ; ")})` : ""}`;
  const sim = o.simulated ? " (simulation de démonstration)" : "";
  switch (o.status) {
    case "succeeded":
      return `C'est fait${sim} : ${o.summary}.`;
    case "awaiting_approval":
      return `Action ${verb}, en attente de votre validation : ${o.summary}.${o.failing_checks?.length ? ` À noter : ${o.failing_checks.join(" ; ")}.` : ""} Dites « oui » pour valider ou modifiez-la à l'écran.`;
    case "uncertain":
      return `Le résultat est incertain : je vérifie chez le fournisseur avant toute nouvelle tentative.`;
    case "failed":
      return `L'action a échoué : ${o.summary}.`;
    case "authorized":
    case "executing":
      return `C'est en cours : ${o.summary}. Je vous confirme dès que le service répond.`;
    default:
      return `${o.summary ?? "Action"} — état : ${o.status}.`;
  }
}
