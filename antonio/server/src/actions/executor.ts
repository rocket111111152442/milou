import { and, desc, eq, sql } from "drizzle-orm";
import type { ActionKind } from "@antonio/shared";
import { db, schema } from "../db/client.js";
import { randomToken } from "../lib/crypto.js";
import { publish } from "../realtime/hub.js";
import { enqueue, JOBS } from "../jobs/queue.js";
import { adapterFor } from "../connectors/registry.js";
import { upsertEvents, withToken } from "../connectors/service.js";
import { type ConnectionRow, type OutgoingMail, ProviderError } from "../connectors/types.js";
import { NON_IDEMPOTENT_KINDS } from "./params.js";
import { evaluate, transition, type ActionRow } from "./service.js";
import type { Origin } from "./policy.js";

const MAX_ATTEMPTS = 3;
const VERIFY_DELAYS_S = [20, 120, 600];

/**
 * Exécute une action autorisée. Garanties :
 *  - réservation atomique (authorized → executing) : deux workers ne l'exécutent jamais deux fois ;
 *  - une action sans règle ni geste direct doit porter une validation dont l'empreinte
 *    correspond au contenu actuel ;
 *  - un envoi interrompu passe en « résultat incertain » et n'est JAMAIS renvoyé
 *    avant vérification chez le fournisseur.
 */
export async function executeAction(actionId: string): Promise<ActionRow | null> {
  const [claimed] = await db()
    .update(schema.actions)
    .set({ status: "executing", attempts: sql`${schema.actions.attempts} + 1`, executedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(schema.actions.id, actionId), eq(schema.actions.status, "authorized")))
    .returning();
  if (!claimed) return null; // déjà prise, exécutée ou annulée
  await publish(claimed.userId, { type: "action.updated", actionId, status: "executing" });
  const action = claimed;
  const actor = { userId: action.userId, orgId: action.orgId };
  const kind = action.kind as ActionKind;

  // Base d'autorisation.
  const needsApproval = action.originRef.autoAuthorized !== true;
  if (needsApproval) {
    const [approval] = await db()
      .select()
      .from(schema.approvals)
      .where(and(eq(schema.approvals.actionId, action.id), eq(schema.approvals.decision, "approved")))
      .orderBy(desc(schema.approvals.createdAt))
      .limit(1);
    if (!approval || approval.paramsHash !== action.paramsHash) {
      return transition(action.id, ["executing"], "awaiting_approval", "system", "Validation absente ou portant sur un autre contenu : nouvelle validation requise.");
    }
  }

  // Revérification juste avant l'exécution (compte, capacités, conflits d'agenda, règle).
  const policy = await evaluate(actor, kind, action.params, action.origin as Origin, {
    ruleId: action.ruleId,
    trigger: action.originRef.triggerMessageId ? { messageId: action.originRef.triggerMessageId as string, text: (action.originRef.triggerText as string) ?? "" } : null,
    userProvidedEmails: [],
  });
  const hard = policy.checks.find((c) => c.blocking && !c.ok);
  if (hard) return transition(action.id, ["executing"], "failed", "system", `${hard.label} : ${hard.detail ?? ""}`, { error: hard.detail ?? hard.label, checks: policy.checks });

  let conn: ConnectionRow | null = null;
  if (action.connectionId) {
    [conn] = await db().select().from(schema.connections).where(eq(schema.connections.id, action.connectionId));
    if (!conn) return transition(action.id, ["executing"], "failed", "system", "Connexion supprimée", { error: "Connexion supprimée" });
  }

  try {
    if (kind === "calendar.create" || (kind === "calendar.update" && action.params.start)) {
      // Disponibilités relues chez le fournisseur juste avant la réservation.
      const start = new Date(action.params.start as string);
      const end = new Date(action.params.end as string);
      const adapter = adapterFor(conn!.provider);
      const busy = await withToken(conn!, (t) => adapter.freeBusy(conn!, t, start, end, (action.params.timezone as string) ?? "UTC"));
      const own = kind === "calendar.update" ? await providerEventIdOf(action) : null;
      const clash = busy.filter((b) => b.start < end && b.end > start && !(own && b.start.getTime() === start.getTime() && b.end.getTime() === end.getTime()));
      if (clash.length) {
        return transition(action.id, ["executing"], "awaiting_approval", "system", "Un conflit est apparu dans l'agenda juste avant la réservation : à revoir.", {
          originRef: { ...action.originRef, autoAuthorized: false },
          checks: [...policy.checks.filter((c) => c.id !== "conflicts"), { id: "conflicts", label: "Aucun conflit dans l'agenda", ok: false, detail: "Conflit détecté au moment de réserver" }],
        });
      }
    }
    const result = await perform(action, conn);
    const done = await transition(action.id, ["executing"], "succeeded", "worker", "Résultat confirmé par le fournisseur", {
      providerResult: result.providerResult,
      revertInfo: result.revertInfo ?? null,
      error: null,
    });
    if (done && action.ruleId) await bumpRuleUse(action.ruleId);
    return done;
  } catch (e) {
    return handleFailure(action, e);
  }
}

async function handleFailure(action: ActionRow, e: unknown) {
  const err = e instanceof ProviderError ? e : new ProviderError((e as Error).message ?? String(e), "unknown");
  const kind = action.kind as ActionKind;
  const effectUnknown = err.kind === "transient" || err.kind === "unknown";
  if (NON_IDEMPOTENT_KINDS.includes(kind) && effectUnknown) {
    // L'envoi a peut-être eu lieu : on vérifie avant toute nouvelle tentative.
    const r = await transition(action.id, ["executing"], "uncertain", "worker", `Résultat incertain (${err.message}) : vérification chez le fournisseur avant tout nouvel essai.`, {
      error: err.message,
    });
    await enqueue(JOBS.verifyAction, { actionId: action.id, attempt: 0 }, { delaySeconds: VERIFY_DELAYS_S[0] });
    return r;
  }
  if ((err.kind === "transient" || err.kind === "rate_limit") && action.attempts < MAX_ATTEMPTS) {
    // Opérations idempotentes (identifiant d'événement, corbeille, libellé) : nouvel essai contrôlé.
    const r = await transition(action.id, ["executing"], "authorized", "worker", `Nouvel essai prévu (${err.message})`, { error: err.message });
    await enqueue(JOBS.executeAction, { actionId: action.id }, { delaySeconds: Math.ceil((err.retryAfterMs ?? 2 ** action.attempts * 15_000) / 1000) });
    return r;
  }
  return transition(action.id, ["executing"], "failed", "worker", `Échec : ${err.message}`, { error: err.message });
}

/** Vérifie un envoi incertain grâce au Message-ID généré par Waverti. */
export async function verifyAction(actionId: string, attempt: number) {
  const [action] = await db().select().from(schema.actions).where(eq(schema.actions.id, actionId));
  if (!action || action.status !== "uncertain") return;
  const [conn] = action.connectionId ? await db().select().from(schema.connections).where(eq(schema.connections.id, action.connectionId)) : [];
  if (!conn) return transition(actionId, ["uncertain"], "failed", "worker", "Connexion indisponible pour vérifier", { error: "Vérification impossible" });
  const internetMessageId = action.originRef.internetMessageId as string | undefined;
  if (!internetMessageId) return;
  try {
    const found = await withToken(conn, (t) => adapterFor(conn.provider).findSent(conn, t, internetMessageId));
    if (found) {
      return transition(actionId, ["uncertain"], "succeeded", "worker", "Envoi confirmé après vérification", {
        providerResult: { providerMessageId: found.providerMessageId, verifiedAfterInterruption: true },
        error: null,
      });
    }
  } catch {
    /* le fournisseur ne répond pas : on retentera la vérification */
  }
  if (attempt + 1 < VERIFY_DELAYS_S.length) {
    await enqueue(JOBS.verifyAction, { actionId, attempt: attempt + 1 }, { delaySeconds: VERIFY_DELAYS_S[attempt + 1] });
    return;
  }
  // Introuvable après la fenêtre de vérification : non envoyé. Aucun renvoi automatique.
  return transition(actionId, ["uncertain"], "failed", "worker", "Aucun envoi trouvé après vérification. Rien n'a été renvoyé automatiquement : relancez l'envoi si nécessaire.", {
    error: "Non envoyé (vérifié)",
  });
}

async function providerEventIdOf(action: ActionRow) {
  const [e] = await db().select({ p: schema.events.providerEventId }).from(schema.events).where(eq(schema.events.id, action.params.eventId as string));
  return e?.p ?? null;
}

async function bumpRuleUse(_ruleId: string) {
  /* compteur calculé à la volée à partir des actions ; point d'extension */
}

interface PerformResult {
  providerResult: Record<string, unknown>;
  revertInfo?: Record<string, unknown> | null;
}

async function perform(action: ActionRow, conn: ConnectionRow | null): Promise<PerformResult> {
  const p = action.params;
  const kind = action.kind as ActionKind;
  const userId = action.userId;

  if (kind === "task.create") {
    const [task] = await db()
      .insert(schema.tasks)
      .values({
        orgId: action.orgId,
        userId,
        title: p.title as string,
        notes: (p.notes as string) ?? null,
        dueAt: p.dueAt ? new Date(p.dueAt as string) : null,
        createdBy: action.origin === "rule" ? "rule" : action.origin === "user" ? "user" : "assistant",
        sourceMessageId: (p.sourceMessageId as string) ?? null,
        actionId: action.id,
      })
      .returning();
    await publish(userId, { type: "tasks.changed" });
    return { providerResult: { taskId: task.id } };
  }
  if (kind === "task.complete") {
    const r = await db()
      .update(schema.tasks)
      .set({ status: "done", completedAt: new Date() })
      .where(and(eq(schema.tasks.id, p.taskId as string), eq(schema.tasks.userId, userId)))
      .returning();
    if (!r.length) throw new ProviderError("Tâche introuvable", "not_found");
    await publish(userId, { type: "tasks.changed" });
    return { providerResult: { taskId: p.taskId } };
  }

  if (!conn) throw new ProviderError("Connexion requise", "invalid");
  const adapter = adapterFor(conn.provider);

  const messageRef = async () => {
    const [m] = await db()
      .select()
      .from(schema.messages)
      .where(and(eq(schema.messages.id, p.messageId as string), eq(schema.messages.userId, userId), eq(schema.messages.connectionId, conn.id)));
    if (!m) throw new ProviderError("Message introuvable sur ce compte", "not_found");
    return m;
  };

  switch (kind) {
    case "email.draft":
    case "email.send":
    case "email.reply": {
      let inReplyTo: OutgoingMail["inReplyTo"] = null;
      if (p.replyToMessageId) {
        const [orig] = await db()
          .select()
          .from(schema.messages)
          .where(and(eq(schema.messages.id, p.replyToMessageId as string), eq(schema.messages.userId, userId), eq(schema.messages.connectionId, conn.id)));
        if (!orig) throw new ProviderError("Message d'origine introuvable sur ce compte", "not_found");
        inReplyTo = { providerMessageId: orig.providerMessageId, providerThreadId: orig.providerThreadId, internetMessageId: orig.internetMessageId };
      }
      // Message-ID stable par action : sert à vérifier un envoi incertain et évite les doublons.
      let internetMessageId = action.originRef.internetMessageId as string | undefined;
      if (!internetMessageId) {
        internetMessageId = `<antonio.${action.id}.${randomToken(6)}@${conn.accountEmail.split("@")[1] ?? "antonio.local"}>`;
        await db()
          .update(schema.actions)
          .set({ originRef: { ...action.originRef, internetMessageId } })
          .where(eq(schema.actions.id, action.id));
        action.originRef = { ...action.originRef, internetMessageId };
      } else if (kind !== "email.draft") {
        // Nouvelle tentative d'un envoi : vérifier d'abord qu'il n'a pas déjà eu lieu.
        const already = await withToken(conn, (t) => adapter.findSent(conn, t, internetMessageId!));
        if (already) return { providerResult: { providerMessageId: already.providerMessageId, deduplicated: true } };
      }
      const mail: OutgoingMail = {
        to: p.to as OutgoingMail["to"],
        cc: (p.cc as OutgoingMail["cc"]) ?? [],
        subject: p.subject as string,
        body: p.body as string,
        internetMessageId,
        inReplyTo,
      };
      if (kind === "email.draft") {
        const r = await withToken(conn, (t) => adapter.createDraft(conn, t, mail));
        return { providerResult: { draftId: r.draftId } };
      }
      const r = await withToken(conn, (t) => adapter.sendMail(conn, t, mail));
      await publish(userId, { type: "messages.changed", connectionId: conn.id });
      return { providerResult: { providerMessageId: r.providerMessageId, providerThreadId: r.providerThreadId, internetMessageId } };
    }
    case "email.trash": {
      const m = await messageRef();
      const r = await withToken(conn, (t) => adapter.trash(conn, t, m.providerMessageId));
      await db().update(schema.messages).set({ inTrash: true }).where(eq(schema.messages.id, m.id));
      await publish(userId, { type: "messages.changed", connectionId: conn.id });
      return { providerResult: { providerMessageId: m.providerMessageId }, revertInfo: r.revertInfo };
    }
    case "email.untrash": {
      const m = await messageRef();
      const [prev] = await db()
        .select({ revertInfo: schema.actions.revertInfo })
        .from(schema.actions)
        .where(and(eq(schema.actions.userId, userId), eq(schema.actions.kind, "email.trash"), sql`${schema.actions.params}->>'messageId' = ${m.id}`))
        .orderBy(desc(schema.actions.createdAt))
        .limit(1);
      await withToken(conn, (t) => adapter.untrash(conn, t, m.providerMessageId, prev?.revertInfo ?? null));
      await db().update(schema.messages).set({ inTrash: false }).where(eq(schema.messages.id, m.id));
      await publish(userId, { type: "messages.changed", connectionId: conn.id });
      return { providerResult: { providerMessageId: m.providerMessageId, restored: true } };
    }
    case "email.archive": {
      const m = await messageRef();
      const r = await withToken(conn, (t) => adapter.archive(conn, t, m.providerMessageId));
      await db().update(schema.messages).set({ archived: true }).where(eq(schema.messages.id, m.id));
      await publish(userId, { type: "messages.changed", connectionId: conn.id });
      return { providerResult: { providerMessageId: m.providerMessageId }, revertInfo: r.revertInfo };
    }
    case "email.label": {
      const m = await messageRef();
      await withToken(conn, (t) => adapter.applyLabel(conn, t, m.providerMessageId, p.label as string));
      await db()
        .update(schema.messages)
        .set({ labels: [...new Set([...m.labels, p.label as string])] })
        .where(eq(schema.messages.id, m.id));
      await publish(userId, { type: "messages.changed", connectionId: conn.id });
      return { providerResult: { providerMessageId: m.providerMessageId, label: p.label } };
    }
    case "email.delete_permanent":
      throw new ProviderError("La suppression définitive n'est pas activée dans cette version (seule la corbeille est utilisée).", "invalid");
    case "calendar.create": {
      const ev = await withToken(conn, (t) =>
        adapter.createEvent(
          conn,
          t,
          {
            title: p.title as string,
            start: new Date(p.start as string),
            end: new Date(p.end as string),
            timezone: p.timezone as string,
            attendees: (p.attendees as { email: string; name: string | null }[]) ?? [],
            location: (p.location as string) ?? null,
            description: (p.description as string) ?? null,
            addOnlineMeeting: Boolean(p.addOnlineMeeting),
          },
          `ant-${action.id}`,
        ),
      );
      await upsertEvents(conn, [ev]);
      await publish(userId, { type: "events.changed", connectionId: conn.id });
      const [row] = await db()
        .select({ id: schema.events.id })
        .from(schema.events)
        .where(and(eq(schema.events.connectionId, conn.id), eq(schema.events.providerEventId, ev.providerEventId)));
      return {
        providerResult: {
          providerEventId: ev.providerEventId,
          eventId: row?.id,
          onlineMeetingUrl: ev.onlineMeetingUrl,
          // Distinction explicite : invitation envoyée ≠ participation acceptée.
          invitationsSent: ev.attendees.length,
          attendeesAccepted: ev.attendees.filter((a) => a.response === "accepted").length,
        },
      };
    }
    case "calendar.update": {
      const providerEventId = await providerEventIdOf(action);
      if (!providerEventId) throw new ProviderError("Événement introuvable", "not_found");
      const ev = await withToken(conn, (t) =>
        adapter.updateEvent(conn, t, providerEventId, {
          title: p.title as string | undefined,
          start: p.start ? new Date(p.start as string) : undefined,
          end: p.end ? new Date(p.end as string) : undefined,
          timezone: (p.timezone as string) ?? "UTC",
          location: p.location as string | null | undefined,
          attendees: p.attendees as { email: string; name: string | null }[] | undefined,
        }),
      );
      await upsertEvents(conn, [ev]);
      await publish(userId, { type: "events.changed", connectionId: conn.id });
      return { providerResult: { providerEventId } };
    }
    case "calendar.cancel": {
      const providerEventId = await providerEventIdOf(action);
      if (!providerEventId) throw new ProviderError("Événement introuvable", "not_found");
      await withToken(conn, (t) => adapter.cancelEvent(conn, t, providerEventId, Boolean(p.notify)));
      await db().update(schema.events).set({ status: "cancelled" }).where(eq(schema.events.id, p.eventId as string));
      await publish(userId, { type: "events.changed", connectionId: conn.id });
      return { providerResult: { providerEventId, cancelled: true } };
    }
  }
  throw new ProviderError(`Type d'action non pris en charge : ${kind}`, "invalid");
}
