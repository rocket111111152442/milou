import type { ActionKind, AutonomyLevel, Category, PolicyCheck } from "@antonio/shared";
import { ACTION_KIND_CATEGORY } from "@antonio/shared";
import { PREPARATION_KINDS, REVERSIBLE_FILING_KINDS } from "./params.js";
import { EXCEPTION_LABELS } from "../mail/analysis.js";

/**
 * Politique d'autorisation — SERVEUR uniquement.
 * Le modèle propose ; cette fonction décide. Aucune décision ne dépend d'un score
 * de confiance annoncé par le modèle : uniquement de faits vérifiés.
 */

export type Origin = "chat" | "voice" | "rule" | "user" | "system";
export type Decision = "execute" | "needs_approval" | "deny";

export interface PolicyInput {
  kind: ActionKind;
  origin: Origin;
  level: AutonomyLevel;
  connection: { ok: boolean; status: string; hasCapability: boolean; capability: string | null; isDemo: boolean } | null;
  recipients: { email: string; provenance: "thread" | "user" | "contact" | "correspondent" | "unknown" }[];
  testAllowlist: string[] | null;
  rule: { id: string; active: boolean; confirmed: boolean; matches: boolean; withinDailyLimit: boolean; allowedExceptions: string[]; templateApproved: boolean | null } | null;
  exceptions: string[];
  calendar: { conflicts: number; withinWorkHours: boolean } | null;
  limits: { actionsToday: number; actionsDaily: number; budgetExceeded: boolean };
  /** Une action identique a déjà été exécutée (ex. réponse déjà envoyée dans ce fil). */
  alreadyDone: boolean;
}

export interface PolicyResult {
  decision: Decision;
  checks: PolicyCheck[];
  reason: string;
}

const CAPABILITY_FOR: Partial<Record<ActionKind, string>> = {
  "email.draft": "mail.draft",
  "email.send": "mail.send",
  "email.reply": "mail.send",
  "email.archive": "mail.modify",
  "email.label": "mail.modify",
  "email.trash": "mail.modify",
  "email.untrash": "mail.modify",
  "email.delete_permanent": "mail.delete_permanent",
  "calendar.create": "calendar.write",
  "calendar.update": "calendar.write",
  "calendar.cancel": "calendar.write",
};
export const capabilityFor = (kind: ActionKind) => CAPABILITY_FOR[kind] ?? null;

export function decide(input: PolicyInput): PolicyResult {
  const checks: PolicyCheck[] = [];
  const category: Category = ACTION_KIND_CATEGORY[input.kind];
  const add = (c: PolicyCheck) => checks.push(c);

  // 1. Compte concerné et capacité accordée.
  const needsConnection = capabilityFor(input.kind) !== null;
  if (needsConnection) {
    const c = input.connection;
    add({
      id: "account",
      label: "Compte connecté et actif",
      ok: Boolean(c?.ok && c.status === "active"),
      detail: c ? (c.status !== "active" ? `Connexion ${c.status}` : undefined) : "Aucune connexion",
      blocking: true,
    });
    add({
      id: "capability",
      label: "Autorisation accordée par le fournisseur",
      ok: Boolean(c?.hasCapability),
      detail: c?.hasCapability ? undefined : `Capacité « ${c?.capability ?? capabilityFor(input.kind)} » non accordée`,
      blocking: true,
    });
  }

  // 2. Niveau d'autonomie de la catégorie.
  add({
    id: "autonomy",
    label: `Niveau d'autonomie « ${category} »`,
    ok: input.level !== "observe",
    detail: input.level === "observe" ? "Catégorie en consultation seule : aucune action possible" : input.level,
    blocking: true,
  });

  // 3. Suppression définitive : toujours une décision explicite, jamais automatique.
  if (input.kind === "email.delete_permanent") {
    add({ id: "permanent_delete", label: "Suppression définitive", ok: false, detail: "Toujours soumise à une autorisation explicite", blocking: false });
  }

  // 4. Destinataires.
  if (input.recipients.length) {
    const unknown = input.recipients.filter((r) => r.provenance === "unknown");
    add({
      id: "recipients",
      label: "Destinataires vérifiés",
      ok: unknown.length === 0,
      detail: unknown.length
        ? `Adresse(s) non fournie(s) par vous et absente(s) du fil ou de vos contacts : ${unknown.map((u) => u.email).join(", ")}`
        : undefined,
    });
    if (input.testAllowlist) {
      const outside = input.recipients.filter((r) => !input.testAllowlist!.includes(r.email));
      add({
        id: "test_allowlist",
        label: "Destinataires de test autorisés",
        ok: outside.length === 0,
        detail: outside.length ? `Environnement de test : ${outside.map((o) => o.email).join(", ")} non prévu(s)` : undefined,
        blocking: true,
      });
    }
  }

  // 5. Exceptions repérées dans le contenu déclencheur.
  if (input.exceptions.length) {
    const allowed = input.rule?.allowedExceptions ?? [];
    const blocking = input.exceptions.filter((e) => !allowed.includes(e));
    add({
      id: "exceptions",
      label: "Aucune exception à la règle",
      ok: blocking.length === 0,
      detail: blocking.length ? blocking.map((e) => EXCEPTION_LABELS[e] ?? e).join(", ") : undefined,
    });
  }

  // 6. Agenda : conflits et horaires.
  if (input.calendar) {
    add({
      id: "conflicts",
      label: "Aucun conflit dans l'agenda",
      ok: input.calendar.conflicts === 0,
      detail: input.calendar.conflicts ? `${input.calendar.conflicts} événement(s) en conflit` : undefined,
    });
    add({ id: "work_hours", label: "Dans les horaires de travail", ok: input.calendar.withinWorkHours });
  }

  // 7. Déjà exécutée.
  add({ id: "not_duplicate", label: "Pas déjà exécutée", ok: !input.alreadyDone, detail: input.alreadyDone ? "Une action équivalente a déjà eu lieu" : undefined });

  // 8. Limites de consommation et d'actions.
  add({
    id: "limits",
    label: "Limites d'actions et de budget",
    ok: input.limits.actionsToday < input.limits.actionsDaily && !input.limits.budgetExceeded,
    detail: input.limits.budgetExceeded
      ? "Budget atteint"
      : input.limits.actionsToday >= input.limits.actionsDaily
        ? `Limite quotidienne d'actions atteinte (${input.limits.actionsDaily})`
        : undefined,
  });

  // 9. Règle applicable.
  if (input.rule) {
    const r = input.rule;
    add({
      id: "rule",
      label: "Règle active et confirmée qui s'applique",
      ok: r.active && r.confirmed && r.matches,
      detail: !r.confirmed ? "Règle non confirmée" : !r.active ? "Règle en pause" : !r.matches ? "Les conditions ne sont plus réunies" : undefined,
    });
    add({ id: "rule_limit", label: "Limite quotidienne de la règle", ok: r.withinDailyLimit });
    if (r.templateApproved !== null) add({ id: "template", label: "Modèle de message approuvé", ok: r.templateApproved });
  }

  // ------------------------------------------------------------- Décision
  const hardFail = checks.find((c) => c.blocking && !c.ok);
  if (hardFail) return { decision: "deny", checks, reason: `${hardFail.label} : ${hardFail.detail ?? "non satisfait"}` };

  const allOk = checks.every((c) => c.ok);
  const failing = checks.filter((c) => !c.ok);

  if (input.kind === "email.delete_permanent") {
    return { decision: "needs_approval", checks, reason: "La suppression définitive demande toujours votre autorisation explicite." };
  }

  // Préparation interne (brouillon, tâche) : sans effet visible par des tiers.
  if (PREPARATION_KINDS.includes(input.kind) && failing.every((c) => c.id === "recipients")) {
    return { decision: "execute", checks, reason: "Préparation sans effet externe, autorisée à ce niveau d'autonomie." };
  }

  // Geste direct dans l'interface (clic) sur une action réversible ou une restauration.
  if (input.origin === "user" && allOk) {
    return { decision: "execute", checks, reason: "Action demandée directement par vous dans l'interface." };
  }

  // Exécution automatique : niveau « auto » + règle confirmée + toutes les vérifications passées.
  if (input.origin === "rule") {
    if (input.level === "auto" && allOk) {
      return { decision: "execute", checks, reason: "Règle approuvée applicable, aucune exception." };
    }
    if (input.level !== "auto") return { decision: "needs_approval", checks, reason: "Catégorie en mode « préparation avec validation »." };
    return { decision: "needs_approval", checks, reason: explain(failing) };
  }

  // Demande orale ou écrite : classement réversible exécuté directement en mode auto.
  if ((input.origin === "chat" || input.origin === "voice") && input.level === "auto" && REVERSIBLE_FILING_KINDS.includes(input.kind) && allOk) {
    return { decision: "execute", checks, reason: "Classement réversible demandé par vous, catégorie en exécution automatique." };
  }

  return {
    decision: "needs_approval",
    checks,
    reason: failing.length ? explain(failing) : "Action préparée : elle attend votre validation.",
  };
}

function explain(failing: PolicyCheck[]): string {
  return `Validation nécessaire — ${failing.map((f) => (f.detail ? `${f.label.toLowerCase()} (${f.detail})` : f.label.toLowerCase())).join(" ; ")}.`;
}
