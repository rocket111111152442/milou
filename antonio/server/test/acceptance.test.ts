/**
 * Tests d'acceptation (cahier des charges §17), exécutés sur une vraie base PostgreSQL.
 * Les fournisseurs réels (Google, Microsoft, OpenAI) ne sont PAS appelés ici :
 * le connecteur de démonstration et des réponses HTTP simulées les remplacent.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { db, schema, closeDb } from "../src/db/client.js";
import { buildApp } from "../src/app.js";
import { createSession, SESSION_COOKIE } from "../src/auth/service.js";
import { approveAction, editAction, proposeAction } from "../src/actions/service.js";
import { executeAction, verifyAction } from "../src/actions/executor.js";
import { demoFaults } from "../src/connectors/demo/adapter.js";
import { disconnect, upsertMessages } from "../src/connectors/service.js";
import { processMessage } from "../src/rules/engine.js";
import { proposeRule, confirmRule } from "../src/rules/service.js";
import { generateBriefing } from "../src/briefing/service.js";
import { runTurn } from "../src/agent/orchestrator.js";
import { runTool } from "../src/agent/tools.js";
import { firstReceipt, handleGraphNotifications } from "../src/webhooks/service.js";
import { recordUsage, setBudget } from "../src/usage/service.js";
import { reportUsage } from "../src/voice/service.js";
import { listMessages } from "../src/mail/data.js";
import { actionRow, autoFor, demoUser, makeUser, messageBySubject } from "./helpers.js";
import type { FastifyInstance } from "fastify";

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildApp();
});
afterAll(async () => {
  await app.close();
  await closeDb();
});

async function cookieFor(a: { userId: string; orgId: string }) {
  return `${SESSION_COOKIE}=${await createSession(a.userId, a.orgId)}`;
}

/** Simule un nouveau message entrant sur le compte de démonstration. */
async function incoming(conn: typeof schema.connections.$inferSelect, id: string, from: { email: string; name: string }, subject: string, body: string) {
  const created = await upsertMessages(conn, [
    {
      providerMessageId: id,
      providerThreadId: `t-${id}`,
      internetMessageId: `<${id}@demo.example>`,
      from,
      to: [{ email: conn.accountEmail, name: null }],
      cc: [],
      subject,
      snippet: body.slice(0, 120),
      receivedAt: new Date(),
      unread: true,
      inTrash: false,
      archived: false,
      isSent: false,
      labels: ["INBOX"],
      folderId: null,
      hasAttachments: false,
      demoBody: body,
    },
  ]);
  return created[0];
}

describe("1. Compte et profil", () => {
  it("crée un compte, une organisation, un profil et applique l'onboarding", async () => {
    const res = await app.inject({ method: "POST", url: "/api/auth/register", payload: { email: "a1@test.example", password: "motdepasse-solide", displayName: "Alex Martin" } });
    expect(res.statusCode).toBe(200);
    const cookie = res.cookies.find((c) => c.name === SESSION_COOKIE)!;
    const headers = { cookie: `${cookie.name}=${cookie.value}` };
    const put = await app.inject({ method: "PUT", url: "/api/profile", headers, payload: { assistantName: "Lucie", timezone: "America/Montreal", workStart: "08:30" } });
    expect(put.statusCode).toBe(200);
    expect(put.json().profile.assistantName).toBe("Lucie");
    expect((await app.inject({ method: "POST", url: "/api/onboarding/complete", headers })).statusCode).toBe(200);
    const me = await app.inject({ method: "GET", url: "/api/auth/me", headers });
    expect(me.json()).toMatchObject({ onboardingCompleted: true, assistantName: "Lucie" });
    const bad = await app.inject({ method: "PUT", url: "/api/profile", headers, payload: { timezone: "Mars/Olympus" } });
    expect(bad.statusCode).toBe(400);
  });
});

describe("3. Lecture des données du bon compte", () => {
  it("ne renvoie que les messages de l'utilisateur et de sa connexion", async () => {
    const { actor } = await demoUser();
    const { actor: other } = await demoUser();
    const mine = await listMessages(actor);
    expect(mine.length).toBeGreaterThan(5);
    const ids = new Set(mine.map((m) => m.id));
    const theirs = await listMessages(other);
    expect(theirs.some((m) => ids.has(m.id))).toBe(false);
    expect(mine.every((m) => m.simulated)).toBe(true);
  });
});

describe("4. Point quotidien fondé sur les données récupérées", () => {
  it("cite les messages et rendez-vous réels, distingue observé/fait/recommandé, et ne répète pas", async () => {
    const { actor } = await demoUser();
    const sophie = await messageBySubject(actor.userId, "refonte");
    const b1 = await generateBriefing(actor, "on_demand");
    expect(b1.sections.importantMessages.some((i) => i.source?.id === sophie.id)).toBe(true);
    expect(b1.sections.agenda.some((i) => i.source?.type === "event")).toBe(true);
    expect(b1.sections.actionsDone).toHaveLength(0);
    expect(b1.simulatedData).toBe(true);
    expect(b1.sections.priorities.every((p) => p.kind === "recommendation")).toBe(true);
    // Une action réussie apparaît une fois, puis n'est pas répétée comme nouvelle.
    const r = await proposeAction(actor, { kind: "task.create", params: { title: "Relancer Claire" }, origin: "user" });
    expect(r.ok && (await actionRow(r.action.id)).status).toBe("succeeded");
    const b2 = await generateBriefing(actor, "on_demand");
    expect(b2.sections.actionsDone.map((i) => i.text).join()).toContain("Relancer Claire");
    expect(new Date(b2.periodStart).getTime()).toBe(new Date(b1.periodEnd).getTime());
    const b3 = await generateBriefing(actor, "on_demand");
    expect(b3.sections.actionsDone).toHaveLength(0);
  });
});

describe("5–6. Brouillon, validation et envoi unique", () => {
  it("crée un brouillon sans validation (préparation)", async () => {
    const { actor, conn } = await demoUser();
    const m = await messageBySubject(actor.userId, "horaires");
    const r = await proposeAction(actor, {
      kind: "email.draft",
      params: { connectionId: conn.id, to: [{ email: m.fromEmail, name: null }], subject: "Re: horaires", body: "Bonjour", replyToMessageId: m.id },
      origin: "chat",
    });
    expect(r.ok).toBe(true);
    const a = await actionRow((r as { action: { id: string } }).action.id);
    expect(a.status).toBe("succeeded");
    expect(a.providerResult?.draftId).toBeTruthy();
  });

  it("attend la validation, envoie une seule fois, et refuse une validation sur un contenu modifié", async () => {
    const { actor, conn } = await demoUser();
    const m = await messageBySubject(actor.userId, "refonte");
    const r = await proposeAction(actor, {
      kind: "email.reply",
      params: { connectionId: conn.id, replyToMessageId: m.id, to: [{ email: m.fromEmail, name: m.fromName }], subject: "Re: refonte", body: "Jeudi 14 h ?" },
      origin: "chat",
      originRef: { turnId: "t1" },
    });
    if (!r.ok) throw new Error(r.error);
    expect(r.action.status).toBe("awaiting_approval");
    const oldHash = r.action.paramsHash;
    // Modification importante => l'ancienne empreinte n'est plus valable.
    await editAction(actor, r.action.id, { body: "Jeudi 15 h plutôt ?" });
    await expect(approveAction(actor, r.action.id, { paramsHash: oldHash, channel: "ui" })).rejects.toThrow(/contenu a changé/);
    const fresh = await actionRow(r.action.id);
    await approveAction(actor, r.action.id, { paramsHash: fresh.paramsHash, channel: "ui" });
    expect((await actionRow(r.action.id)).status).toBe("succeeded");
    // Double validation et ré-exécution : aucun second envoi.
    await expect(approveAction(actor, r.action.id, { paramsHash: fresh.paramsHash, channel: "ui" })).rejects.toThrow();
    expect(await executeAction(r.action.id)).toBeNull();
    const sent = await db()
      .select()
      .from(schema.messages)
      .where(and(eq(schema.messages.connectionId, conn.id), eq(schema.messages.isSent, true), eq(schema.messages.providerThreadId, m.providerThreadId)));
    expect(sent).toHaveLength(1);
    // La même proposition (même tour) ne crée pas de doublon.
    const again = await proposeAction(actor, {
      kind: "email.reply",
      params: { connectionId: conn.id, replyToMessageId: m.id, to: [{ email: m.fromEmail, name: m.fromName }], subject: "Re: refonte", body: "Jeudi 14 h ?" },
      origin: "chat",
      originRef: { turnId: "t1" },
    });
    expect(again.ok && again.created).toBe(false);
  });

  it("une validation par l'API exige l'empreinte affichée", async () => {
    const { actor, conn } = await demoUser();
    const m = await messageBySubject(actor.userId, "horaires");
    const r = await proposeAction(actor, {
      kind: "email.reply",
      params: { connectionId: conn.id, replyToMessageId: m.id, to: [{ email: m.fromEmail, name: null }], subject: "Re", body: "Bonjour" },
      origin: "voice",
    });
    if (!r.ok) throw new Error(r.error);
    const cookie = await cookieFor(actor);
    const bad = await app.inject({ method: "POST", url: `/api/actions/${r.action.id}/approve`, headers: { cookie }, payload: { paramsHash: "0".repeat(64) } });
    expect(bad.statusCode).toBe(409);
    const ok = await app.inject({ method: "POST", url: `/api/actions/${r.action.id}/approve`, headers: { cookie }, payload: { paramsHash: r.action.paramsHash } });
    expect(ok.statusCode).toBe(200);
    expect((await actionRow(r.action.id)).status).toBe("succeeded");
  });
});

async function setupAutoReplyRule(actor: { userId: string; orgId: string }) {
  await autoFor(actor, "messages");
  const [tpl] = await db()
    .insert(schema.templates)
    .values({ orgId: actor.orgId, userId: actor.userId, name: "Infos pratiques", body: "Bonjour {{prenom}},\n\nNous sommes ouverts du lundi au vendredi, 9 h – 18 h.\n\n{{signature}}", approved: true })
    .returning();
  const rule = await proposeRule(actor, { name: "Réponse horaires", conditions: { subjectContains: ["horaires"] }, action: { type: "reply_template", templateId: tpl.id }, exceptions: [], dailyLimit: 20 });
  expect(rule.status).toBe("proposed");
  await confirmRule(actor, rule.id);
  return { tpl, rule };
}

describe("7–8. Règles : réponse automatique et mise en attente hors périmètre", () => {
  it("répond automatiquement avec le modèle approuvé quand la règle s'applique", async () => {
    const { actor, conn } = await demoUser();
    const { rule } = await setupAutoReplyRule(actor);
    const id = await incoming(conn, "n-1", { email: "client@boutique.example", name: "Jeanne Roux" }, "Vos horaires", "Bonjour, quels sont vos horaires ?");
    await processMessage(id);
    const [a] = await db().select().from(schema.actions).where(eq(schema.actions.ruleId, rule.id));
    expect(a.status).toBe("succeeded");
    expect(a.origin).toBe("rule");
    expect(a.params.to).toEqual([{ email: "client@boutique.example", name: "Jeanne Roux" }]);
    expect(String(a.params.body)).toContain("Bonjour Jeanne");
  });

  it("met en attente une demande hors périmètre (modification de prix)", async () => {
    const { actor, conn } = await demoUser();
    const { rule } = await setupAutoReplyRule(actor);
    const id = await incoming(conn, "n-2", { email: "achat@client.example", name: "Paul" }, "Horaires et tarif", "Quels horaires ? Et le prix passe à 49 € ?");
    await processMessage(id);
    const [a] = await db().select().from(schema.actions).where(eq(schema.actions.ruleId, rule.id));
    expect(a.status).toBe("awaiting_approval");
    expect(JSON.stringify(a.checks)).toContain("Montant ou modification de prix");
  });

  it("n'applique rien tant que la catégorie est en « préparation avec validation »", async () => {
    const { actor, conn } = await demoUser();
    const { rule } = await setupAutoReplyRule(actor);
    await db().update(schema.autonomy).set({ level: "prepare" }).where(and(eq(schema.autonomy.userId, actor.userId), eq(schema.autonomy.category, "messages")));
    const id = await incoming(conn, "n-3", { email: "x@client.example", name: "X" }, "Horaires", "Vos horaires ?");
    await processMessage(id);
    const [a] = await db().select().from(schema.actions).where(eq(schema.actions.ruleId, rule.id));
    expect(a.status).toBe("awaiting_approval");
  });
});

describe("9. Rendez-vous", () => {
  it("crée un rendez-vous sans conflit et met en attente en cas de conflit", async () => {
    const { actor, conn } = await demoUser();
    await autoFor(actor, "calendar");
    // Créneau libre : dans 20 jours à 10 h (heure de Paris), via l'outil comme le ferait l'assistant.
    const d = new Date(Date.now() + 20 * 86400_000);
    const ymd = d.toISOString().slice(0, 10);
    const ctx = { actor, channel: "chat" as const, conversationId: "00000000-0000-0000-0000-000000000000", turnId: "turn-cal", userUtterance: "", userEmails: [], presentedActionIds: [], presentedRuleIds: [], presentedMemoryIds: [] };
    const r = await runTool("schedule_meeting", { title: "Point Sophie", start: `${ymd}T10:00`, duration_min: 60, attendees: ["sophie.martin@client-atelier.example"] }, ctx);
    const out = r.output as { action_id: string; status: string };
    // Une invitation à un tiers attend la validation (aucune règle de réservation confirmée).
    expect(out.status).toBe("awaiting_approval");
    const a = await actionRow(out.action_id);
    expect((a.checks as { id: string; ok: boolean }[]).find((c) => c.id === "conflicts")?.ok).toBe(true);
    await approveAction(actor, a.id, { paramsHash: a.paramsHash, channel: "ui" });
    const done = await actionRow(a.id);
    expect(done.status).toBe("succeeded");
    expect(done.providerResult).toMatchObject({ invitationsSent: 1, attendeesAccepted: 0 });
    // Même horaire : conflit détecté.
    const r2 = await runTool("schedule_meeting", { title: "Autre", start: `${ymd}T10:30`, duration_min: 30 }, { ...ctx, turnId: "turn-cal-2" });
    const a2 = await actionRow((r2.output as { action_id: string }).action_id);
    expect(a2.status).toBe("awaiting_approval");
    expect((a2.checks as { id: string; ok: boolean }[]).find((c) => c.id === "conflicts")?.ok).toBe(false);
    void conn;
  });
});

describe("10. Événement reçu plusieurs fois", () => {
  it("ne crée qu'une action et un seul envoi", async () => {
    const { actor, conn } = await demoUser();
    const { rule } = await setupAutoReplyRule(actor);
    const id = await incoming(conn, "dup-1", { email: "c@client.example", name: "C" }, "Horaires", "Vos horaires ?");
    // Même notification livrée trois fois (upsert + traitement + règles).
    await incoming(conn, "dup-1", { email: "c@client.example", name: "C" }, "Horaires", "Vos horaires ?");
    await Promise.all([processMessage(id), processMessage(id), processMessage(id)]);
    const { applyRules } = await import("../src/rules/engine.js");
    const [msg] = await db().select().from(schema.messages).where(eq(schema.messages.id, id));
    await applyRules(msg, "Vos horaires ?");
    const acts = await db().select().from(schema.actions).where(eq(schema.actions.ruleId, rule.id));
    expect(acts).toHaveLength(1);
    const sent = await db().select().from(schema.messages).where(and(eq(schema.messages.providerThreadId, "t-dup-1"), eq(schema.messages.isSent, true)));
    expect(sent).toHaveLength(1);
    expect(await firstReceipt("google-pubsub", "msg-42")).toBe(true);
    expect(await firstReceipt("google-pubsub", "msg-42")).toBe(false);
  });
});

describe("11. Corbeille et restauration", () => {
  it("déplace vers la corbeille puis restaure", async () => {
    const { actor, conn } = await demoUser();
    const m = await messageBySubject(actor.userId, "lettre hebdomadaire");
    const r = await proposeAction(actor, { kind: "email.trash", params: { connectionId: conn.id, messageId: m.id }, origin: "user" });
    if (!r.ok) throw new Error(r.error);
    expect((await actionRow(r.action.id)).status).toBe("succeeded");
    expect((await messageBySubject(actor.userId, "lettre hebdomadaire")).inTrash).toBe(true);
    const cookie = await cookieFor(actor);
    const rev = await app.inject({ method: "POST", url: `/api/actions/${r.action.id}/revert`, headers: { cookie } });
    expect(rev.statusCode).toBe(200);
    expect((await messageBySubject(actor.userId, "lettre hebdomadaire")).inTrash).toBe(false);
    // Un envoi, lui, n'est pas présenté comme annulable.
    const m2 = await messageBySubject(actor.userId, "horaires");
    const s = await proposeAction(actor, { kind: "email.reply", params: { connectionId: conn.id, replyToMessageId: m2.id, to: [{ email: m2.fromEmail, name: null }], subject: "Re", body: "Ok" }, origin: "chat" });
    if (!s.ok) throw new Error(s.error);
    await approveAction(actor, s.action.id, { paramsHash: s.action.paramsHash, channel: "ui" });
    const revSend = await app.inject({ method: "POST", url: `/api/actions/${s.action.id}/revert`, headers: { cookie } });
    expect(revSend.statusCode).toBe(409);
    expect(revSend.json().message).toMatch(/ne peut pas être rappelé/);
  });
});

describe("12. Révocation d'une connexion", () => {
  it("révoque, supprime les copies locales et annule les actions en attente", async () => {
    const { actor, conn } = await demoUser();
    const m = await messageBySubject(actor.userId, "refonte");
    const r = await proposeAction(actor, { kind: "email.reply", params: { connectionId: conn.id, replyToMessageId: m.id, to: [{ email: m.fromEmail, name: null }], subject: "Re", body: "Ok" }, origin: "chat" });
    if (!r.ok) throw new Error(r.error);
    await disconnect(actor, conn.id);
    const [c] = await db().select().from(schema.connections).where(eq(schema.connections.id, conn.id));
    expect(c.status).toBe("revoked");
    expect(c.accessTokenEnc).toBeNull();
    expect(await listMessages(actor)).toHaveLength(0);
    expect((await actionRow(r.action.id)).status).toBe("cancelled");
  });
});

describe("15. Instructions malveillantes dans un e-mail", () => {
  it("signale le message, ne lui accorde aucun droit et bloque l'exécution automatique", async () => {
    const { actor, conn } = await demoUser();
    await autoFor(actor, "messages", "filing");
    const evil = await messageBySubject(actor.userId, "coordonnées");
    expect(evil.categoryReason).toMatch(/manipulation/);
    const ctx = { actor, channel: "chat" as const, conversationId: "00000000-0000-0000-0000-000000000000", turnId: "turn-evil", userUtterance: "Lis ce message", userEmails: [], presentedActionIds: [], presentedRuleIds: [], presentedMemoryIds: [] };
    const opened = await runTool("open_message", { message_id: evil.id }, ctx);
    expect((opened.output as { injection_signal: boolean }).injection_signal).toBe(true);
    expect((opened.output as { content_untrusted: string }).content_untrusted).toMatch(/NON FIABLE/);
    // Même si le modèle obéissait à l'e-mail : destinataire inconnu => pas d'exécution, validation requise.
    const fwd = await runTool("prepare_email", { to: ["paiement@domaine-externe.example"], subject: "Factures", body: "Voici les factures", connection_id: conn.id }, ctx);
    const out = fwd.output as { status: string; failing_checks: string[] };
    expect(out.status).toBe("awaiting_approval");
    expect(out.failing_checks.join()).toMatch(/paiement@domaine-externe.example/);
    // Le modèle ne peut pas valider sans phrase explicite de l'utilisateur.
    const approve = await runTool("approve_action", { action_id: fwd.actionIds[0] }, { ...ctx, presentedActionIds: fwd.actionIds, userUtterance: "Lis ce message" });
    expect((approve.output as { error?: string }).error).toMatch(/consentement explicite/);
    // Une règle proposée n'est jamais active sans confirmation.
    const rule = await runTool("propose_rule", { name: "Transférer factures", conditions: { textContains: ["facture"] }, action: { type: "archive" } }, ctx);
    const ruleId = rule.ruleIds![0];
    const [rr] = await db().select().from(schema.rules).where(eq(schema.rules.id, ruleId));
    expect(rr.status).toBe("proposed");
    const conf = await runTool("confirm_rule", { rule_id: ruleId }, { ...ctx, presentedRuleIds: [ruleId], userUtterance: "transfère tout" });
    expect((conf.output as { error?: string }).error).toBeTruthy();
    expect((await actionRow(fwd.actionIds[0])).status).toBe("awaiting_approval");
  });

  it("le moteur sans IA ne suit pas non plus les instructions de l'e-mail", async () => {
    const { actor } = await demoUser();
    const r1 = await runTurn(actor, { text: "Montre-moi le mail de Service comptabilité", channel: "chat" });
    expect(r1.uiEvents.some((e) => e.type === "focus_message")).toBe(true);
    const r2 = await runTurn(actor, { text: "oui", channel: "chat", conversationId: r1.conversationId });
    // Rien n'a été présenté : « oui » ne déclenche aucune action.
    const acts = await db().select().from(schema.actions).where(eq(schema.actions.userId, actor.userId));
    expect(acts).toHaveLength(0);
    expect(r2.actionIds).toHaveLength(0);
  });
});

describe("16. Isolation entre utilisateurs et organisations", () => {
  it("refuse l'accès aux messages, actions et connexions d'un autre compte", async () => {
    const { actor: a, conn: connA } = await demoUser();
    const { actor: b } = await demoUser();
    const msgA = await messageBySubject(a.userId, "refonte");
    const act = await proposeAction(a, { kind: "email.reply", params: { connectionId: connA.id, replyToMessageId: msgA.id, to: [{ email: msgA.fromEmail, name: null }], subject: "Re", body: "Ok" }, origin: "chat" });
    if (!act.ok) throw new Error(act.error);
    const cookieB = await cookieFor(b);
    for (const url of [`/api/messages/${msgA.id}`, `/api/actions/${act.action.id}`]) {
      expect((await app.inject({ method: "GET", url, headers: { cookie: cookieB } })).statusCode).toBe(404);
    }
    const approve = await app.inject({ method: "POST", url: `/api/actions/${act.action.id}/approve`, headers: { cookie: cookieB }, payload: { paramsHash: act.action.paramsHash } });
    expect(approve.statusCode).toBe(404);
    expect((await app.inject({ method: "DELETE", url: `/api/connections/${connA.id}`, headers: { cookie: cookieB } })).statusCode).toBe(404);
    // B ne peut pas agir sur le compte de A en passant son identifiant de connexion.
    const cross = await app.inject({
      method: "POST",
      url: "/api/actions",
      headers: { cookie: cookieB },
      payload: { kind: "email.trash", params: { connectionId: connA.id, messageId: msgA.id }, clientRequestId: "cross-tenant-1" },
    });
    expect(cross.statusCode).toBe(422);
    expect((await messageBySubject(a.userId, "refonte")).inTrash).toBe(false);
    expect((await app.inject({ method: "GET", url: "/api/messages" })).statusCode).toBe(401);
  });
});

describe("17. Échec et résultat incertain", () => {
  it("coupure APRÈS l'envoi : résultat incertain, puis confirmé par vérification, sans renvoi", async () => {
    const { actor, conn } = await demoUser();
    const m = await messageBySubject(actor.userId, "refonte");
    const r = await proposeAction(actor, { kind: "email.reply", params: { connectionId: conn.id, replyToMessageId: m.id, to: [{ email: m.fromEmail, name: null }], subject: "Re", body: "Test coupure" }, origin: "chat" });
    if (!r.ok) throw new Error(r.error);
    demoFaults.failNextSendAfterEffect = true;
    await approveAction(actor, r.action.id, { paramsHash: r.action.paramsHash, channel: "ui" });
    expect((await actionRow(r.action.id)).status).toBe("uncertain");
    await verifyAction(r.action.id, 0);
    const a = await actionRow(r.action.id);
    expect(a.status).toBe("succeeded");
    expect(a.providerResult).toMatchObject({ verifiedAfterInterruption: true });
    const sent = await db().select().from(schema.messages).where(and(eq(schema.messages.connectionId, conn.id), eq(schema.messages.isSent, true), eq(schema.messages.providerThreadId, m.providerThreadId)));
    expect(sent).toHaveLength(1);
  });

  it("coupure AVANT l'envoi : après vérification, échec déclaré et aucun renvoi automatique", async () => {
    const { actor, conn } = await demoUser();
    const m = await messageBySubject(actor.userId, "horaires");
    const r = await proposeAction(actor, { kind: "email.reply", params: { connectionId: conn.id, replyToMessageId: m.id, to: [{ email: m.fromEmail, name: null }], subject: "Re", body: "Test" }, origin: "chat" });
    if (!r.ok) throw new Error(r.error);
    demoFaults.failNextSendBeforeEffect = true;
    await approveAction(actor, r.action.id, { paramsHash: r.action.paramsHash, channel: "ui" });
    expect((await actionRow(r.action.id)).status).toBe("uncertain");
    for (const i of [0, 1, 2]) await verifyAction(r.action.id, i);
    const a = await actionRow(r.action.id);
    expect(a.status).toBe("failed");
    expect(a.error).toMatch(/Non envoyé/);
    const sent = await db().select().from(schema.messages).where(and(eq(schema.messages.connectionId, conn.id), eq(schema.messages.isSent, true), eq(schema.messages.providerThreadId, m.providerThreadId)));
    expect(sent).toHaveLength(0);
  });
});

describe("18. Limites de consommation", () => {
  it("bascule sur les commandes simples quand le budget est atteint et refuse la voix", async () => {
    const actor = await makeUser();
    await setBudget("user", actor.userId, { monthlyLimitMicros: 1000 });
    await recordUsage({ orgId: actor.orgId, userId: actor.userId, kind: "text_model", quantity: 10, unit: "tokens", costMicros: 5000 });
    process.env.OPENAI_API_KEY = "sk-test-non-utilisee";
    const { resetConfigForTests } = await import("../src/config.js");
    resetConfigForTests();
    try {
      const r = await runTurn(actor, { text: "Montre-moi mes rendez-vous", channel: "chat" });
      expect(r.engine).toBe("demo");
      expect(r.limited).toMatch(/Budget mensuel atteint/);
      const cookie = await cookieFor(actor);
      const v = await app.inject({ method: "POST", url: "/api/voice/session", headers: { cookie }, payload: { sdp: "v=0 fake sdp" } });
      expect(v.statusCode).toBe(402);
    } finally {
      delete process.env.OPENAI_API_KEY;
      resetConfigForTests();
    }
  });

  it("ferme une session vocale qui dépasse sa durée maximale et limite les actions automatiques", async () => {
    const { actor, conn } = await demoUser();
    await setBudget("user", actor.userId, { voiceSessionMaxMinutes: 1, actionsDaily: 0 });
    const [vs] = await db().insert(schema.voiceSessions).values({ orgId: actor.orgId, userId: actor.userId, status: "active" }).returning();
    expect((await reportUsage(actor, vs.id, 30)).continue).toBe(true);
    const r = await reportUsage(actor, vs.id, 75);
    expect(r.continue).toBe(false);
    const [usage] = await db().select().from(schema.usageRecords).where(and(eq(schema.usageRecords.userId, actor.userId), eq(schema.usageRecords.kind, "voice")));
    expect(usage).toBeTruthy();
    // Limite d'actions quotidiennes à 0 : une règle ne peut plus exécuter automatiquement.
    const { rule } = await setupAutoReplyRule(actor);
    const id = await incoming(conn, "lim-1", { email: "l@client.example", name: "L" }, "Horaires", "Vos horaires ?");
    await processMessage(id);
    const [a] = await db().select().from(schema.actions).where(eq(schema.actions.ruleId, rule.id));
    expect(a.status).toBe("awaiting_approval");
  });
});

describe("Webhooks : authentification des notifications", () => {
  it("répond au jeton de validation Graph et ignore un clientState inconnu", async () => {
    const res = await app.inject({ method: "POST", url: "/api/webhooks/microsoft?validationToken=abc%20123" });
    expect(res.statusCode).toBe(200);
    expect(res.body).toBe("abc 123");
    expect((await handleGraphNotifications({ value: [{ subscriptionId: "inconnu", clientState: "x" }] })).accepted).toBe(0);
    const cal = await app.inject({ method: "POST", url: "/api/webhooks/google/calendar", headers: { "x-goog-channel-id": "nope", "x-goog-channel-token": "bad" } });
    expect(cal.statusCode).toBe(401);
    const pubsub = await app.inject({ method: "POST", url: "/api/webhooks/google/pubsub", payload: {} });
    expect(pubsub.statusCode).toBe(401);
  });
});

describe("Conversation : scénario de la vision produit (moteur sans IA)", () => {
  it("point → mail de Sophie → créneau jeudi → plus court → pourquoi → oui", async () => {
    const { actor } = await demoUser();
    const t1 = await runTurn(actor, { text: "Antonio, fais-moi le point sur ma journée.", channel: "voice" });
    expect(t1.uiEvents[0]?.type).toBe("show_briefing");
    const t2 = await runTurn(actor, { text: "Montre-moi le mail de Sophie.", channel: "voice", conversationId: t1.conversationId });
    expect(t2.uiEvents.some((e) => e.type === "focus_message")).toBe(true);
    const t3 = await runTurn(actor, { text: "Propose-lui un créneau jeudi après-midi.", channel: "voice", conversationId: t1.conversationId });
    expect(t3.uiEvents.some((e) => e.type === "show_slots")).toBe(true);
    const actionId = t3.actionIds[0];
    expect((await actionRow(actionId)).status).toBe("awaiting_approval");
    const t4 = await runTurn(actor, { text: "Prépare une réponse plus courte.", channel: "voice", conversationId: t1.conversationId });
    expect(t4.text).toMatch(/attente de votre validation/);
    const t5 = await runTurn(actor, { text: "Pourquoi tu as répondu ça ?", channel: "voice", conversationId: t1.conversationId });
    expect(t5.text).toMatch(/Origine/);
    const t6 = await runTurn(actor, { text: "Oui, envoie.", channel: "voice", conversationId: t1.conversationId });
    expect((await actionRow(actionId)).status).toBe("succeeded");
    expect(t6.text).toMatch(/simulation/);
    const t7 = await runTurn(actor, { text: "Quels dossiers attendent une réponse depuis trois jours ?", channel: "voice", conversationId: t1.conversationId });
    // Le devis envoyé il y a 4 jours et la demande de Thomas reçue il y a ~3 jours, sans réponse.
    expect(t7.text).toMatch(/2 dossiers/);
  });
});
