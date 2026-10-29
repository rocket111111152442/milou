import {
  and,
  emailOutbox,
  entitlements,
  eq,
  monitoringTasks,
  notifications,
  profiles,
  type Executor,
  type NotificationType,
  type Priority,
} from "@watchly/database";

export interface NotifyInput {
  userId: string;
  type: NotificationType;
  priority?: Priority;
  title: string;
  body: string;
  taskId?: string | null;
  taskName?: string | null;
  siteId?: string | null;
  incidentId?: string | null;
  resultId?: string | null;
  sourceUrl?: string | null;
  linkPath?: string | null;
  /** Clé de déduplication : une même clé ne produit qu'une notification par utilisateur. */
  dedupKey?: string | null;
  /**
   * « transactional » : e-mail toujours envoyé (abonnement, sécurité) indépendamment de la formule.
   * « alert » : e-mail seulement si la formule inclut les alertes e-mail et que l'utilisateur les a activées.
   * « none » : pas d'e-mail.
   */
  emailPolicy?: "transactional" | "alert" | "none";
  emailTemplate?: string;
  emailPayload?: Record<string, unknown>;
}

export interface NotifyResult {
  notificationId: string;
  email: "pending" | "skipped" | "none";
  desktop: "pending" | "none";
}

const SAFE_URL = /^https?:\/\//i;

/**
 * Crée une notification in-app (dédupliquée) et planifie les canaux e-mail / desktop
 * selon les préférences de l'utilisateur, celles de la surveillance et la formule.
 * Retourne null si la notification existait déjà (doublon).
 */
export async function notify(db: Executor, input: NotifyInput): Promise<NotifyResult | null> {
  const [profile] = await db
    .select({
      email: profiles.email,
      notifyEmail: profiles.notifyEmail,
      notifyDesktop: profiles.notifyDesktop,
      suspendedAt: profiles.suspendedAt,
    })
    .from(profiles)
    .where(eq(profiles.id, input.userId))
    .limit(1);
  if (!profile) return null;

  let taskPrefs = { email: true, desktop: true };
  if (input.taskId) {
    const [task] = await db
      .select({ email: monitoringTasks.notifyEmail, desktop: monitoringTasks.notifyDesktop })
      .from(monitoringTasks)
      .where(and(eq(monitoringTasks.id, input.taskId), eq(monitoringTasks.userId, input.userId)))
      .limit(1);
    if (task) taskPrefs = task;
  }

  const policy = input.emailPolicy ?? "alert";
  let wantsEmail = false;
  if (policy === "transactional") wantsEmail = true;
  else if (policy === "alert") {
    const [ent] = await db
      .select({ emailAlerts: entitlements.emailAlerts })
      .from(entitlements)
      .where(eq(entitlements.userId, input.userId))
      .limit(1);
    wantsEmail = Boolean(ent?.emailAlerts) && profile.notifyEmail && taskPrefs.email;
  }
  if (profile.suspendedAt && policy !== "transactional") wantsEmail = false;
  const wantsDesktop = profile.notifyDesktop && taskPrefs.desktop && policy !== "transactional";

  const inserted = await db
    .insert(notifications)
    .values({
      userId: input.userId,
      type: input.type,
      priority: input.priority ?? "normal",
      title: input.title.slice(0, 200),
      body: input.body.slice(0, 2000),
      taskId: input.taskId ?? null,
      taskName: input.taskName ?? null,
      siteId: input.siteId ?? null,
      incidentId: input.incidentId ?? null,
      resultId: input.resultId ?? null,
      sourceUrl: input.sourceUrl && SAFE_URL.test(input.sourceUrl) ? input.sourceUrl.slice(0, 2048) : null,
      linkPath: input.linkPath && input.linkPath.startsWith("/") ? input.linkPath.slice(0, 500) : null,
      dedupKey: input.dedupKey ?? null,
      emailStatus: policy === "none" ? "none" : wantsEmail ? "pending" : "skipped",
      desktopStatus: wantsDesktop ? "pending" : "none",
    })
    .onConflictDoNothing()
    .returning({ id: notifications.id });
  const notificationId = inserted[0]?.id;
  if (!notificationId) return null;

  if (wantsEmail && profile.email) {
    await db
      .insert(emailOutbox)
      .values({
        userId: input.userId,
        notificationId,
        toEmail: profile.email,
        template: input.emailTemplate ?? "alert",
        subject: input.title.slice(0, 200),
        payload: {
          title: input.title,
          body: input.body,
          taskName: input.taskName ?? null,
          sourceUrl: input.sourceUrl ?? null,
          linkPath: input.linkPath ?? null,
          priority: input.priority ?? "normal",
          ...(input.emailPayload ?? {}),
        },
        priority: input.priority ?? "normal",
        idempotencyKey: `notification:${notificationId}`,
      })
      .onConflictDoNothing();
  }
  return {
    notificationId,
    email: policy === "none" ? "none" : wantsEmail ? "pending" : "skipped",
    desktop: wantsDesktop ? "pending" : "none",
  };
}

/** E-mail transactionnel sans notification in-app (ex. accusé de réception d'assistance). */
export async function queueEmail(
  db: Executor,
  input: { toEmail: string; userId?: string | null; template: string; subject: string; payload: Record<string, unknown>; idempotencyKey: string },
): Promise<void> {
  await db
    .insert(emailOutbox)
    .values({
      toEmail: input.toEmail,
      userId: input.userId ?? null,
      template: input.template,
      subject: input.subject,
      payload: input.payload,
      idempotencyKey: input.idempotencyKey,
    })
    .onConflictDoNothing();
}
