import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import type { ActionDTO, ActionKind, ActionStatus, PolicyCheck } from "@antonio/shared";
import { ACTION_KIND_CATEGORY, ACTION_KIND_LABELS } from "@antonio/shared";
import { db, schema } from "../db/client.js";
import { hashParams, sha256 } from "../lib/crypto.js";
import { AppError, badRequest, notFound } from "../lib/audit.js";
import { autonomyLevel, getProfile } from "../lib/profile.js";
import { formatDateTimeFr, withinWorkHours } from "../lib/time.js";
import { publish } from "../realtime/hub.js";
import { enqueue, JOBS } from "../jobs/queue.js";
import { adapterFor } from "../connectors/registry.js";
import type { Actor } from "../connectors/service.js";
import { testRecipientAllowlist } from "../config.js";
import { effectiveBudget } from "../usage/service.js";
import { detectExceptions, isMeetingRequest } from "../mail/analysis.js";
import { ruleMatches, type RuleConditions } from "../rules/match.js";
import { capabilityFor, decide, type Origin, type PolicyInput, type PolicyResult } from "./policy.js";
import { parseParams } from "./params.js";

export type ActionRow = typeof schema.actions.$inferSelect;

export interface ProposeInput {
  kind: ActionKind;
  params: unknown;
  origin: Origin;
  originRef?: Record<string, unknown>;
  ruleId?: string | null;
  idempotencyKey?: string;
  reason?: string | null;
  /** Adresses écrites par l'utilisateur lui-même (provenance « utilisateur »). */
  userProvidedEmails?: string[];
  /** Message déclencheur (règles) : sert aux exceptions et à la revérification. */
  trigger?: { messageId: string; text: string } | null;
}

export type ProposeResult =
  | { ok: true; action: ActionRow; created: boolean; policy: PolicyResult }
  | { ok: false; error: string; missing?: string[]; checks?: PolicyCheck[] };

// ---------------------------------------------------------------------------
// Proposition
// ---------------------------------------------------------------------------

export async function proposeAction(actor: Actor, input: ProposeInput): Promise<ProposeResult> {
  const parsed = parseParams(input.kind, input.params);
  if (!parsed.ok) return { ok: false, error: "Informations manquantes ou invalides", missing: parsed.missing };
  const params = parsed.params;
  const paramsHash = hashParams({ kind: input.kind, ...params });
  const idempotencyKey = input.idempotencyKey ?? `${input.origin}:${input.kind}:${paramsHash}:${(input.originRef?.turnId as string) ?? ""}`;

  // Doublon : la même clé renvoie l'action existante (événement reçu plusieurs fois, double clic, nouvel essai).
  const [dup] = await db()
    .select()
    .from(schema.actions)
    .where(and(eq(schema.actions.userId, actor.userId), eq(schema.actions.idempotencyKey, idempotencyKey)));
  if (dup) return { ok: true, action: dup, created: false, policy: { decision: "needs_approval", checks: dup.checks as PolicyCheck[], reason: dup.reason ?? "" } };

  const connectionId = (params.connectionId as string | undefined) ?? null;
  const connection = connectionId ? await loadConnection(actor, connectionId) : null;
  if (connectionId && !connection) return { ok: false, error: "Compte introuvable pour cet utilisateur" };

  const policy = await evaluate(actor, input.kind, params, input.origin, {
    ruleId: input.ruleId ?? null,
    trigger: input.trigger ?? null,
    userProvidedEmails: input.userProvidedEmails ?? [],
  });
  if (policy.decision === "deny" && input.origin !== "rule") {
    return { ok: false, error: policy.reason, checks: policy.checks };
  }

  const summary = await summarize(actor, input.kind, params);
  const status: ActionStatus = policy.decision === "execute" ? "authorized" : policy.decision === "deny" ? "cancelled" : "awaiting_approval";
  const inserted = await db()
    .insert(schema.actions)
    .values({
      orgId: actor.orgId,
      userId: actor.userId,
      connectionId,
      kind: input.kind,
      category: ACTION_KIND_CATEGORY[input.kind],
      status,
      idempotencyKey,
      origin: input.origin,
      // autoAuthorized : posé uniquement par le serveur quand la politique autorise l'exécution sans validation.
      originRef: {
        ...(input.originRef ?? {}),
        ...(input.trigger ? { triggerMessageId: input.trigger.messageId } : {}),
        autoAuthorized: policy.decision === "execute",
      },
      ruleId: input.ruleId ?? null,
      params,
      paramsHash,
      summary,
      reason: input.reason ? `${input.reason} — ${policy.reason}` : policy.reason,
      checks: policy.checks,
      reversibility: connection ? adapterFor(connection.provider).reversibility(input.kind) : input.kind.startsWith("task.") ? "reversible" : "irreversible",
      simulated: connection?.provider === "demo",
      error: policy.decision === "deny" ? policy.reason : null,
    })
    .onConflictDoNothing({ target: [schema.actions.userId, schema.actions.idempotencyKey] })
    .returning();
  if (!inserted[0]) {
    // Course entre deux livraisons simultanées : l'autre insertion a gagné.
    const [existing] = await db()
      .select()
      .from(schema.actions)
      .where(and(eq(schema.actions.userId, actor.userId), eq(schema.actions.idempotencyKey, idempotencyKey)));
    return { ok: true, action: existing, created: false, policy };
  }
  const action = inserted[0];
  await logTransition(action.id, null, status, input.origin === "rule" ? "rule" : input.origin === "user" ? "user" : "assistant", policy.reason);
  await publish(actor.userId, { type: "action.updated", actionId: action.id, status });
  if (status === "authorized") await enqueue(JOBS.executeAction, { actionId: action.id });
  return { ok: true, action, created: true, policy };
}

async function loadConnection(actor: Actor, id: string) {
  const [c] = await db()
    .select()
    .from(schema.connections)
    .where(and(eq(schema.connections.id, id), eq(schema.connections.userId, actor.userId), eq(schema.connections.orgId, actor.orgId)));
  return c ?? null;
}

// ---------------------------------------------------------------------------
// Collecte des faits pour la politique
// ---------------------------------------------------------------------------

export async function evaluate(
  actor: Actor,
  kind: ActionKind,
  params: Record<string, unknown>,
  origin: Origin,
  ctx: { ruleId: string | null; trigger: { messageId: string; text: string } | null; userProvidedEmails: string[] },
): Promise<PolicyResult> {
  const profile = await getProfile(actor.userId);
  const level = await autonomyLevel(actor.userId, ACTION_KIND_CATEGORY[kind]);
  const connectionId = params.connectionId as string | undefined;
  const conn = connectionId ? await loadConnection(actor, connectionId) : null;
  const cap = capabilityFor(kind);

  // Provenance des destinataires.
  const recipients: PolicyInput["recipients"] = [];
  const to = [...((params.to as { email: string }[]) ?? []), ...((params.cc as { email: string }[]) ?? [])].map((a) => a.email.toLowerCase());
  if (to.length) {
    const thread = new Set<string>();
    if (params.replyToMessageId) {
      const [orig] = await db()
        .select()
        .from(schema.messages)
        .where(and(eq(schema.messages.id, params.replyToMessageId as string), eq(schema.messages.userId, actor.userId)));
      if (orig) {
        const threadMsgs = await db()
          .select()
          .from(schema.messages)
          .where(and(eq(schema.messages.connectionId, orig.connectionId), eq(schema.messages.providerThreadId, orig.providerThreadId)));
        for (const m of threadMsgs) {
          thread.add(m.fromEmail);
          for (const a of [...m.toList, ...m.ccList]) thread.add(a.email);
        }
      }
    }
    const contacts = new Set(profile.priorityContacts.map((c) => c.email.toLowerCase()));
    const userGiven = new Set(ctx.userProvidedEmails.map((e) => e.toLowerCase()));
    const sentRows = await db()
      .select({ toList: schema.messages.toList })
      .from(schema.messages)
      .where(and(eq(schema.messages.userId, actor.userId), eq(schema.messages.isSent, true)))
      .limit(500);
    const correspondents = new Set(sentRows.flatMap((r) => r.toList.map((a) => a.email)));
    for (const email of to) {
      recipients.push({
        email,
        provenance:
          origin === "user" || userGiven.has(email)
            ? "user"
            : thread.has(email)
              ? "thread"
              : contacts.has(email)
                ? "contact"
                : correspondents.has(email)
                  ? "correspondent"
                  : "unknown",
      });
    }
  }

  // Règle applicable : revérifiée côté serveur sur le message déclencheur.
  let rule: PolicyInput["rule"] = null;
  let exceptions: string[] = [];
  if (ctx.ruleId) {
    const [r] = await db()
      .select()
      .from(schema.rules)
      .where(and(eq(schema.rules.id, ctx.ruleId), eq(schema.rules.userId, actor.userId)));
    let matches = false;
    let alreadyReplied = false;
    if (r && ctx.trigger) {
      const [msg] = await db()
        .select()
        .from(schema.messages)
        .where(and(eq(schema.messages.id, ctx.trigger.messageId), eq(schema.messages.userId, actor.userId)));
      if (msg) {
        matches = ruleMatches(r.conditions as RuleConditions, {
          fromEmail: msg.fromEmail,
          subject: msg.subject,
          text: ctx.trigger.text,
          category: msg.category,
          meetingRequest: isMeetingRequest(msg.subject, ctx.trigger.text),
        });
        const [reply] = await db()
          .select({ id: schema.messages.id })
          .from(schema.messages)
          .where(
            and(
              eq(schema.messages.connectionId, msg.connectionId),
              eq(schema.messages.providerThreadId, msg.providerThreadId),
              eq(schema.messages.isSent, true),
              gte(schema.messages.receivedAt, msg.receivedAt),
            ),
          )
          .limit(1);
        alreadyReplied = Boolean(reply);
        exceptions = detectExceptions({
          subject: msg.subject,
          text: ctx.trigger.text,
          hasAttachments: msg.hasAttachments,
          ccCount: msg.ccList.filter((c) => c.email !== conn?.accountEmail).length,
          alreadyReplied: alreadyReplied && (kind === "email.reply" || kind === "email.send"),
        });
      }
    }
    const today = new Date(Date.now() - 86400_000);
    const [{ n }] = r
      ? await db()
          .select({ n: sql<number>`count(*)::int` })
          .from(schema.actions)
          .where(and(eq(schema.actions.ruleId, r.id), gte(schema.actions.createdAt, today), inArray(schema.actions.status, ["authorized", "executing", "succeeded"])))
      : [{ n: 0 }];
    let templateApproved: boolean | null = null;
    const ruleAction = r?.action as { type?: string; templateId?: string } | undefined;
    if (ruleAction?.type === "reply_template" && ruleAction.templateId) {
      const [t] = await db()
        .select({ approved: schema.templates.approved })
        .from(schema.templates)
        .where(and(eq(schema.templates.id, ruleAction.templateId), eq(schema.templates.userId, actor.userId)));
      templateApproved = Boolean(t?.approved);
    }
    rule = r
      ? {
          id: r.id,
          active: r.status === "active",
          confirmed: Boolean(r.confirmedAt),
          matches,
          withinDailyLimit: n < r.dailyLimit,
          allowedExceptions: (r.exceptions as string[]).filter((e) => e.startsWith("allow:")).map((e) => e.slice(6)),
          templateApproved,
        }
      : { id: ctx.ruleId, active: false, confirmed: false, matches: false, withinDailyLimit: false, allowedExceptions: [], templateApproved: null };
  }

  // Agenda.
  let calendar: PolicyInput["calendar"] = null;
  if ((kind === "calendar.create" || (kind === "calendar.update" && params.start)) && params.start && params.end) {
    const start = new Date(params.start as string);
    const end = new Date(params.end as string);
    const conflicts = await db()
      .select({ id: schema.events.id })
      .from(schema.events)
      .where(
        and(
          eq(schema.events.userId, actor.userId),
          sql`${schema.events.startAt} < ${end.toISOString()}::timestamptz`,
          sql`${schema.events.endAt} > ${start.toISOString()}::timestamptz`,
          sql`${schema.events.status} <> 'cancelled'`,
          sql`${schema.events.showAs} <> 'free'`,
          params.eventId ? sql`${schema.events.id} <> ${params.eventId as string}` : sql`true`,
        ),
      );
    calendar = { conflicts: conflicts.length, withinWorkHours: withinWorkHours(start, end, profile) };
  }

  // Limites.
  const b = await effectiveBudget(actor.orgId, actor.userId);
  const [{ n: actionsToday }] = await db()
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.actions)
    .where(
      and(
        eq(schema.actions.userId, actor.userId),
        gte(schema.actions.createdAt, new Date(Date.now() - 86400_000)),
        inArray(schema.actions.status, ["authorized", "executing", "succeeded", "uncertain"]),
      ),
    );

  // Déjà fait ?
  let alreadyDone = false;
  if (kind === "task.create" && params.sourceMessageId) {
    const [t] = await db()
      .select({ id: schema.tasks.id })
      .from(schema.tasks)
      .where(and(eq(schema.tasks.userId, actor.userId), eq(schema.tasks.sourceMessageId, params.sourceMessageId as string), eq(schema.tasks.title, params.title as string)));
    alreadyDone = Boolean(t);
  }
  if ((kind === "email.trash" || kind === "email.archive") && params.messageId) {
    const [m] = await db().select().from(schema.messages).where(and(eq(schema.messages.id, params.messageId as string), eq(schema.messages.userId, actor.userId)));
    alreadyDone = kind === "email.trash" ? Boolean(m?.inTrash) : Boolean(m?.archived);
  }

  return decide({
    kind,
    origin,
    level,
    connection: conn
      ? { ok: true, status: conn.status, hasCapability: cap ? conn.capabilities.includes(cap) : true, capability: cap, isDemo: conn.provider === "demo" }
      : cap
        ? null
        : { ok: true, status: "active", hasCapability: true, capability: null, isDemo: false },
    recipients,
    testAllowlist: conn?.provider === "demo" ? null : testRecipientAllowlist(),
    rule,
    exceptions,
    calendar,
    // Le budget concerne l'IA et la voix ; les actions déterministes (règles) n'ont pas de coût modèle.
    limits: { actionsToday, actionsDaily: b.actionsDaily, budgetExceeded: false },
    alreadyDone,
  });
}

// ---------------------------------------------------------------------------
// Validation, refus, modification, annulation
// ---------------------------------------------------------------------------

export async function getOwnedAction(actor: Actor, id: string): Promise<ActionRow> {
  const [a] = await db()
    .select()
    .from(schema.actions)
    .where(and(eq(schema.actions.id, id), eq(schema.actions.userId, actor.userId), eq(schema.actions.orgId, actor.orgId)));
  if (!a) throw notFound("Action");
  return a;
}

/**
 * Valide une action PRÉCISE dans son contenu ACTUEL : l'empreinte affichée à
 * l'utilisateur doit correspondre à l'empreinte courante des paramètres.
 */
export async function approveAction(actor: Actor, id: string, opts: { paramsHash: string; channel: "ui" | "voice" | "chat"; utterance?: string | null }) {
  const action = await getOwnedAction(actor, id);
  if (action.status !== "awaiting_approval") throw new AppError(409, "invalid_state", `Cette action n'attend pas de validation (état : ${action.status}).`);
  if (opts.paramsHash !== action.paramsHash) {
    throw new AppError(409, "stale_approval", "Le contenu a changé depuis son affichage : relisez la nouvelle version avant de valider.");
  }
  // Revérification au moment de la validation (compte, capacités, limites).
  const policy = await evaluate(actor, action.kind as ActionKind, action.params, action.origin as Origin, {
    ruleId: action.ruleId,
    trigger: null,
    userProvidedEmails: [],
  });
  const hard = policy.checks.find((c) => c.blocking && !c.ok);
  if (hard) throw new AppError(409, "policy_blocked", `${hard.label} : ${hard.detail ?? "non satisfait"}`);
  await db().insert(schema.approvals).values({
    actionId: action.id,
    userId: actor.userId,
    paramsHash: action.paramsHash,
    decision: "approved",
    channel: opts.channel,
    utterance: opts.utterance ?? null,
  });
  const moved = await transition(action.id, ["awaiting_approval"], "authorized", "user", `Validée (${opts.channel})`, { checks: policy.checks });
  if (!moved) throw new AppError(409, "invalid_state", "Action déjà traitée.");
  await enqueue(JOBS.executeAction, { actionId: action.id });
  return moved;
}

export async function rejectAction(actor: Actor, id: string, channel: "ui" | "voice" | "chat" = "ui") {
  const action = await getOwnedAction(actor, id);
  await db().insert(schema.approvals).values({ actionId: action.id, userId: actor.userId, paramsHash: action.paramsHash, decision: "rejected", channel });
  const moved = await transition(action.id, ["awaiting_approval", "proposed"], "cancelled", "user", "Refusée");
  if (!moved) throw new AppError(409, "invalid_state", "Cette action ne peut plus être refusée.");
  return moved;
}

export async function cancelAction(actor: Actor, id: string) {
  const action = await getOwnedAction(actor, id);
  const moved = await transition(action.id, ["awaiting_approval", "proposed", "authorized"], "cancelled", "user", "Annulée avant exécution");
  if (!moved) {
    throw new AppError(
      409,
      "invalid_state",
      action.status === "succeeded"
        ? "Action déjà exécutée chez le fournisseur : elle ne peut pas être annulée ici."
        : `Annulation impossible dans l'état « ${action.status} ».`,
    );
  }
  return moved;
}

/** Modifier le contenu invalide toute validation précédente (nouvelle empreinte). */
export async function editAction(actor: Actor, id: string, patch: Record<string, unknown>) {
  const action = await getOwnedAction(actor, id);
  if (!["awaiting_approval", "proposed"].includes(action.status)) throw new AppError(409, "invalid_state", "Seule une action en attente peut être modifiée.");
  const parsed = parseParams(action.kind as ActionKind, { ...action.params, ...patch, connectionId: action.params.connectionId });
  if (!parsed.ok) throw badRequest(parsed.missing.join(" ; "));
  const paramsHash = hashParams({ kind: action.kind, ...parsed.params });
  if (paramsHash === action.paramsHash) return action;
  const policy = await evaluate(actor, action.kind as ActionKind, parsed.params, action.origin as Origin, {
    ruleId: action.ruleId,
    trigger: null,
    userProvidedEmails: [],
  });
  const summary = await summarize(actor, action.kind as ActionKind, parsed.params);
  const [updated] = await db()
    .update(schema.actions)
    .set({ params: parsed.params, paramsHash, summary, checks: policy.checks, status: "awaiting_approval", originRef: { ...action.originRef, autoAuthorized: false }, updatedAt: new Date() })
    .where(and(eq(schema.actions.id, action.id), inArray(schema.actions.status, ["awaiting_approval", "proposed"])))
    .returning();
  if (!updated) throw new AppError(409, "invalid_state", "Action déjà traitée.");
  await logTransition(action.id, action.status, "awaiting_approval", "user", "Contenu modifié : la validation précédente ne s'applique plus.");
  await publish(actor.userId, { type: "action.updated", actionId: action.id, status: "awaiting_approval" });
  return updated;
}

/** Retour en arrière uniquement quand le fournisseur le permet réellement. */
export async function revertAction(actor: Actor, id: string) {
  const action = await getOwnedAction(actor, id);
  if (action.status !== "succeeded") throw new AppError(409, "invalid_state", "Seule une action réussie peut être inversée.");
  if (action.kind === "email.trash") {
    return proposeAction(actor, {
      kind: "email.untrash",
      params: { connectionId: action.params.connectionId, messageId: action.params.messageId },
      origin: "user",
      originRef: { revertOf: action.id },
      idempotencyKey: `revert:${action.id}`,
    });
  }
  if (action.kind === "task.create" && action.providerResult?.taskId) {
    await db()
      .delete(schema.tasks)
      .where(and(eq(schema.tasks.id, action.providerResult.taskId as string), eq(schema.tasks.userId, actor.userId)));
    await logTransition(action.id, "succeeded", "succeeded", "user", "Tâche supprimée (retour arrière)");
    await publish(actor.userId, { type: "tasks.changed" });
    return { ok: true as const };
  }
  throw new AppError(
    409,
    "irreversible",
    action.kind === "email.send" || action.kind === "email.reply"
      ? "Un e-mail envoyé ne peut pas être rappelé : le fournisseur ne permet pas d'annuler un envoi."
      : "Le fournisseur ne permet pas d'annuler automatiquement cette action.",
  );
}

// ---------------------------------------------------------------------------
// Transitions & journal
// ---------------------------------------------------------------------------

export async function transition(
  actionId: string,
  from: ActionStatus[],
  to: ActionStatus,
  actor: string,
  note: string | null,
  extra: Partial<typeof schema.actions.$inferInsert> = {},
): Promise<ActionRow | null> {
  const [row] = await db()
    .update(schema.actions)
    .set({ ...extra, status: to, updatedAt: new Date(), ...(["succeeded", "failed", "cancelled"].includes(to) ? { completedAt: new Date() } : {}) })
    .where(and(eq(schema.actions.id, actionId), inArray(schema.actions.status, from)))
    .returning();
  if (!row) return null;
  await logTransition(actionId, from.join("|"), to, actor, note);
  await publish(row.userId, { type: "action.updated", actionId, status: to });
  return row;
}

async function logTransition(actionId: string, from: string | null, to: string, actor: string, note: string | null) {
  await db().insert(schema.actionEvents).values({ actionId, fromStatus: from, toStatus: to, actor, note });
}

// ---------------------------------------------------------------------------
// Lecture
// ---------------------------------------------------------------------------

export async function listActions(actor: Actor, opts: { statuses?: ActionStatus[]; limit?: number; since?: Date } = {}) {
  const conds = [eq(schema.actions.userId, actor.userId), eq(schema.actions.orgId, actor.orgId)];
  if (opts.statuses?.length) conds.push(inArray(schema.actions.status, opts.statuses));
  if (opts.since) conds.push(gte(schema.actions.createdAt, opts.since));
  return db()
    .select()
    .from(schema.actions)
    .where(and(...conds))
    .orderBy(desc(schema.actions.createdAt))
    .limit(opts.limit ?? 100);
}

export async function toActionDTOs(rows: ActionRow[]): Promise<ActionDTO[]> {
  const ruleIds = [...new Set(rows.map((r) => r.ruleId).filter(Boolean))] as string[];
  const connIds = [...new Set(rows.map((r) => r.connectionId).filter(Boolean))] as string[];
  const rulesRows = ruleIds.length ? await db().select({ id: schema.rules.id, name: schema.rules.name }).from(schema.rules).where(inArray(schema.rules.id, ruleIds)) : [];
  const connRows = connIds.length
    ? await db().select({ id: schema.connections.id, email: schema.connections.accountEmail }).from(schema.connections).where(inArray(schema.connections.id, connIds))
    : [];
  const ruleName = new Map(rulesRows.map((r) => [r.id, r.name]));
  const account = new Map(connRows.map((c) => [c.id, c.email]));
  return rows.map((a) => ({
    id: a.id,
    kind: a.kind as ActionKind,
    category: a.category as ActionDTO["category"],
    status: a.status as ActionStatus,
    origin: a.origin as ActionDTO["origin"],
    summary: a.summary,
    reason: a.reason,
    params: a.params,
    paramsHash: a.paramsHash,
    checks: a.checks as PolicyCheck[],
    ruleId: a.ruleId,
    ruleName: a.ruleId ? (ruleName.get(a.ruleId) ?? null) : null,
    connectionId: a.connectionId,
    accountLabel: a.connectionId ? (account.get(a.connectionId) ?? null) : null,
    providerResult: a.providerResult ?? null,
    reversibility: a.reversibility as ActionDTO["reversibility"],
    error: a.error,
    simulated: a.simulated,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
    completedAt: a.completedAt?.toISOString() ?? null,
  }));
}

export async function actionHistory(actor: Actor, id: string) {
  await getOwnedAction(actor, id);
  return db().select().from(schema.actionEvents).where(eq(schema.actionEvents.actionId, id)).orderBy(schema.actionEvents.createdAt);
}

async function summarize(actor: Actor, kind: ActionKind, p: Record<string, unknown>): Promise<string> {
  const label = ACTION_KIND_LABELS[kind];
  const to = (p.to as { email: string; name: string | null }[] | undefined)?.map((a) => a.name ?? a.email).join(", ");
  switch (kind) {
    case "email.send":
    case "email.reply":
    case "email.draft":
      return `${label} à ${to} — « ${p.subject as string} »`;
    case "email.trash":
    case "email.untrash":
    case "email.archive":
    case "email.label":
    case "email.delete_permanent": {
      const [m] = await db()
        .select({ subject: schema.messages.subject, from: schema.messages.fromEmail })
        .from(schema.messages)
        .where(and(eq(schema.messages.id, p.messageId as string), eq(schema.messages.userId, actor.userId)));
      return `${label}${kind === "email.label" ? ` « ${p.label as string} »` : ""} — ${m ? `« ${m.subject} » de ${m.from}` : "message"}`;
    }
    case "calendar.create": {
      const profile = await getProfile(actor.userId);
      return `${label} « ${p.title as string} » — ${formatDateTimeFr(new Date(p.start as string), profile.timezone)}`;
    }
    case "calendar.update":
    case "calendar.cancel": {
      const [e] = await db().select({ title: schema.events.title }).from(schema.events).where(and(eq(schema.events.id, p.eventId as string), eq(schema.events.userId, actor.userId)));
      return `${label} « ${e?.title ?? "événement"} »`;
    }
    case "task.create":
      return `${label} : ${p.title as string}`;
    case "task.complete":
      return label;
  }
}

/** Empreinte courte affichable (permet à l'utilisateur de vérifier ce qu'il valide). */
export const shortHash = (h: string) => sha256(h).slice(0, 8);
