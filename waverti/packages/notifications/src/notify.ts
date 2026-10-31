import {
  and,
  consumeUsage,
  emailOutbox,
  entitlements,
  eq,
  monitoringTasks,
  notifications,
  profiles,
  sql,
  usagePeriod,
  type Executor,
  type NotificationType,
  type Priority,
} from "@waverti/database";

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
  /** Interne : notification de synthèse déjà issue de la protection anti-répétition. */
  bypassBusinessGuard?: boolean;
  now?: Date;
}

export interface NotifyResult {
  notificationId: string;
  email: "pending" | "skipped" | "none";
  desktop: "pending" | "none";
  /** true : e-mail non envoyé car le quota mensuel d'alertes e-mail de la formule est atteint. */
  emailQuotaReached?: boolean;
  /** E-mail Business non envoyé par la protection anti-répétition (l'alerte reste dans l'application). */
  emailSuppressed?: BusinessEmailGuard;
}

/**
 * Protection des e-mails de panne / rétablissement Business (non décomptés du quota de la formule) :
 *  - « grouped » : un e-mail du même type a déjà été envoyé pour ce site il y a moins de 10 minutes
 *    (plusieurs points de contrôle tombés en même temps) ;
 *  - « flapping » : le site a déjà déclenché N e-mails de panne dans l'heure (site instable) : un seul
 *    e-mail « site instable » est envoyé, les suivants restent dans l'application ;
 *  - « daily_cap » : plafond technique anti-abus par compte et par 24 h.
 * L'incident est toujours confirmé avant toute alerte (second contrôle, cf. business/uptime.ts).
 */
export type BusinessEmailGuard = "grouped" | "flapping" | "daily_cap";
const GROUP_WINDOW_MINUTES = 10;

async function settingInt(db: Executor, key: string, fallback: number): Promise<number> {
  const r = await db.execute<{ value: unknown }>(sql`select value from app_settings where key = ${key}`);
  const v = Number(r[0]?.value);
  return Number.isInteger(v) && v > 0 ? v : fallback;
}

async function businessEmailGuard(db: Executor, userId: string, siteId: string, type: NotificationType, now: Date): Promise<BusinessEmailGuard | null> {
  const dailyCap = await settingInt(db, "limit.business_alert_emails_per_day", 60);
  const flapLimit = await settingInt(db, "limit.business_flapping_per_hour", 4);
  const [r] = await db.execute<{ day: string; site_hour_down: string; site_recent_same: string }>(sql`
    select
      (select count(*) from notifications
        where user_id = ${userId} and type in ('business_down', 'business_recovered') and email_status in ('pending', 'sent')
          and created_at > ${now.toISOString()}::timestamptz - interval '24 hours')::text as day,
      (select count(*) from notifications
        where site_id = ${siteId} and type = 'business_down' and email_status in ('pending', 'sent')
          and created_at > ${now.toISOString()}::timestamptz - interval '1 hour')::text as site_hour_down,
      (select count(*) from notifications
        where site_id = ${siteId} and type = ${type} and email_status in ('pending', 'sent')
          and created_at > ${now.toISOString()}::timestamptz - make_interval(mins => ${GROUP_WINDOW_MINUTES}))::text as site_recent_same`);
  if (Number(r?.day ?? 0) >= dailyCap) return "daily_cap";
  if (Number(r?.site_hour_down ?? 0) >= flapLimit) return "flapping";
  if (Number(r?.site_recent_same ?? 0) > 0) return "grouped";
  return null;
}

/**
 * Alertes Business de panne et de rétablissement : jamais bloquées par le quota mensuel d'e-mails
 * (cœur de l'offre Business ; leur nombre est déjà borné par la confirmation des incidents).
 */
const EMAIL_QUOTA_EXEMPT = new Set<NotificationType>(["business_down", "business_recovered"]);

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
  let emailQuota: number | null = null;
  if (policy === "transactional") wantsEmail = true;
  else if (policy === "alert") {
    const [ent] = await db
      .select({ emailAlerts: entitlements.emailAlerts, monthlyEmailAlerts: entitlements.monthlyEmailAlerts })
      .from(entitlements)
      .where(eq(entitlements.userId, input.userId))
      .limit(1);
    wantsEmail = Boolean(ent?.emailAlerts) && profile.notifyEmail && taskPrefs.email;
    if (!EMAIL_QUOTA_EXEMPT.has(input.type)) emailQuota = ent?.monthlyEmailAlerts ?? 0;
  }
  if (profile.suspendedAt && policy !== "transactional") wantsEmail = false;
  const now = input.now ?? new Date();
  let suppressed: BusinessEmailGuard | null = null;
  if (wantsEmail && EMAIL_QUOTA_EXEMPT.has(input.type) && input.siteId && !input.bypassBusinessGuard) {
    suppressed = await businessEmailGuard(db, input.userId, input.siteId, input.type, now);
    if (suppressed) wantsEmail = false;
  }
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

  if (suppressed === "flapping" && input.siteId) {
    // Une seule synthèse « site instable » par site et par heure, envoyée par e-mail.
    await notify(db, {
      userId: input.userId,
      type: "business_down",
      priority: input.priority ?? "high",
      title: "Site instable : pannes répétées",
      body: "Ce site a subi plusieurs pannes et rétablissements en moins d'une heure. Pour éviter de vous submerger d'e-mails, les alertes suivantes de l'heure restent visibles dans l'application et sur la page de l'incident.",
      siteId: input.siteId,
      linkPath: `/app/business/sites/${input.siteId}`,
      dedupKey: `business_flapping:${input.siteId}:${now.toISOString().slice(0, 13)}`,
      emailPolicy: "alert",
      bypassBusinessGuard: true,
      now,
    });
  } else if (suppressed === "daily_cap") {
    await db
      .insert(notifications)
      .values({
        userId: input.userId,
        type: "system",
        priority: "normal",
        title: "Limite technique d'e-mails Business atteinte",
        body: "Un nombre inhabituel d'alertes Business a été envoyé par e-mail en 24 heures. Les alertes suivantes restent visibles dans l'application et sur le bureau ; les e-mails reprendront automatiquement.",
        linkPath: "/app/business",
        dedupKey: `business_email_cap:${now.toISOString().slice(0, 10)}`,
        emailStatus: "none",
        desktopStatus: "none",
      })
      .onConflictDoNothing();
  }

  // Quota mensuel d'alertes e-mail : réservé atomiquement, uniquement pour une notification nouvelle.
  let emailQuotaReached = false;
  if (wantsEmail && emailQuota !== null) {
    const period = usagePeriod("month");
    const ok = await consumeUsage(db, { userId: input.userId, metric: "email_alert", period, limit: emailQuota });
    if (ok === null) {
      wantsEmail = false;
      emailQuotaReached = true;
      await db.update(notifications).set({ emailStatus: "skipped" }).where(eq(notifications.id, notificationId));
      // Une seule information par mois : l'alerte reste visible dans l'application et sur le bureau.
      await db
        .insert(notifications)
        .values({
          userId: input.userId,
          type: "system",
          priority: "normal",
          title: "Quota d'alertes e-mail atteint ce mois-ci",
          body: `Vos ${emailQuota} alertes e-mail mensuelles ont été envoyées. Les alertes suivantes restent visibles dans l'application et sur votre bureau jusqu'au 1er du mois prochain.`,
          linkPath: "/app/abonnement",
          dedupKey: `email_quota:${period}`,
          emailStatus: "none",
          desktopStatus: "none",
        })
        .onConflictDoNothing();
    }
  }

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
    ...(emailQuotaReached ? { emailQuotaReached } : {}),
    ...(suppressed ? { emailSuppressed: suppressed } : {}),
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
