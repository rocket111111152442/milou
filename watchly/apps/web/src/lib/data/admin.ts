import "server-only";
/**
 * Données de l'administration LULLIN WEB. Accès réservé (requireAdmin / withAdmin) ;
 * lecture avec la connexion serveur (sans RLS) car l'administration voit tous les comptes.
 * Tous les indicateurs sont calculés à partir des données réelles ; rien n'est extrapolé.
 */
import { adminAuditLogs, sql, type Executor } from "@watchly/database";
import { getDb } from "../db";

export interface AdminKpis {
  users: { total: number; new7d: number; new30d: number; suspended: number; withoutSubscription: number };
  plans: Array<{ planId: string; name: string; active: number; trialing: number; pastDue: number }>;
  trials: { started30d: number; converted30d: number; canceled30d: number; inProgress: number; blockedDuplicates30d: number };
  cancellations30d: number;
  mrrCents: number;
  collected30d: { cents: number; invoices: number; liveMode: boolean };
  monitors: { page: number; webTopic: number; paused: number; errors: number };
  devices: { total: number; online: number; consented: number };
  business: { sites: number; verified: number; openIncidents: number; endpoints: number };
  jobs24h: { succeeded: number; failed: number; pending: number; oldestPendingMinutes: number | null };
  workers: Array<{
    workerId: string;
    hostname: string;
    role: string;
    lastSeenAt: string;
    online: boolean;
    succeeded: number;
    failed: number;
    /** Boucles de traitement ayant échoué dans la dernière heure (nombre cumulé depuis le démarrage, dernier message). */
    loopErrors: Array<{ loop: string; errors: number; lastError: string | null; lastErrorAt: string }>;
  }>;
  costs: { monthMicros: number; budgetEur: number; byProvider: Array<{ provider: string; units: number; micros: number; cacheHits: number }> };
  emails24h: { sent: number; failed: number; pending: number };
  billingEventsFailed: number;
  openTickets: number;
}

const n = (v: unknown) => Number(v ?? 0);

export async function getAdminKpis(db: Executor = getDb()): Promise<AdminKpis> {
  const [users] = await db.execute(sql`
    select count(*) as total,
      count(*) filter (where created_at > now() - interval '7 days') as new7d,
      count(*) filter (where created_at > now() - interval '30 days') as new30d,
      count(*) filter (where suspended_at is not null) as suspended
    from profiles`);
  const plans = await db.execute(sql`
    select p.id as plan_id, p.name,
      count(s.*) filter (where s.status = 'active') as active,
      count(s.*) filter (where s.status = 'trialing') as trialing,
      count(s.*) filter (where s.status = 'past_due') as past_due
    from plans p left join subscriptions s on s.plan_id = p.id
    group by p.id, p.name, p.sort_order order by p.sort_order`);
  const [free] = await db.execute(sql`
    select count(*) as n from profiles pr
    where not exists (select 1 from subscriptions s where s.user_id = pr.id and s.status in ('active', 'trialing', 'past_due'))`);
  const [trials] = await db.execute(sql`
    select count(*) filter (where started_at > now() - interval '30 days' and status <> 'blocked_duplicate') as started,
      count(*) filter (where status = 'converted' and ended_at > now() - interval '30 days') as converted,
      count(*) filter (where status = 'canceled' and ended_at > now() - interval '30 days') as canceled,
      count(*) filter (where status = 'started') as in_progress,
      count(*) filter (where status = 'blocked_duplicate' and started_at > now() - interval '30 days') as blocked
    from trial_usage`);
  const [cancel] = await db.execute(sql`select count(*) as n from subscriptions where canceled_at > now() - interval '30 days'`);
  const [mrr] = await db.execute(sql`
    select coalesce(sum(p.price_cents), 0) + coalesce(sum(s.extra_sites * a.price_cents), 0) as cents
    from subscriptions s join plans p on p.id = s.plan_id
    left join plan_addons a on a.id = 'business_extra_site'
    where s.status in ('active', 'past_due') and not s.cancel_at_period_end`);
  const [collected] = await db.execute(sql`
    select coalesce(sum((summary->>'amount_paid')::bigint), 0) as cents, count(*) as invoices,
      coalesce(bool_or((summary->>'livemode')::boolean), false) as live
    from billing_events where type = 'invoice.paid' and stripe_created_at > now() - interval '30 days' and status = 'processed'`);
  const [mon] = await db.execute(sql`
    select count(*) filter (where kind = 'page' and status in ('active', 'error')) as page,
      count(*) filter (where kind = 'web_topic' and status in ('active', 'error')) as web,
      count(*) filter (where status in ('paused', 'paused_quota')) as paused,
      count(*) filter (where status = 'error') as errors
    from monitoring_tasks`);
  const [dev] = await db.execute(sql`
    select count(*) filter (where status = 'active') as total,
      count(*) filter (where status = 'active' and last_seen_at > now() - interval '3 minutes') as online,
      count(*) filter (where status = 'active' and consent_local_at is not null and monitoring_enabled) as consented
    from agent_devices`);
  const [biz] = await db.execute(sql`
    select (select count(*) from business_sites) as sites,
      (select count(*) from business_sites where status = 'verified') as verified,
      (select count(*) from incidents where status = 'open') as open_incidents,
      (select count(*) from business_endpoints where enabled) as endpoints`);
  const [jobs] = await db.execute(sql`
    select count(*) filter (where status = 'succeeded' and finished_at > now() - interval '24 hours') as ok,
      count(*) filter (where status = 'failed' and finished_at > now() - interval '24 hours') as failed,
      count(*) filter (where status = 'pending') as pending,
      extract(epoch from now() - min(slot_at) filter (where status = 'pending' and slot_at < now())) / 60 as oldest
    from monitoring_jobs`);
  const workers = await db.execute(sql`select * from worker_heartbeats order by last_seen_at desc limit 50`);
  const byProvider = await db.execute(sql`
    select provider, sum(units) as units, sum(estimated_cost_micros) as micros, count(*) filter (where cache_hit) as hits
    from api_usage where occurred_at >= date_trunc('month', now()) group by provider order by micros desc`);
  const [budget] = await db.execute(sql`select (value)::text::numeric as eur from app_settings where key = 'budget.monthly_api_eur'`);
  const [emails] = await db.execute(sql`
    select count(*) filter (where status = 'sent') as sent, count(*) filter (where status = 'failed') as failed, count(*) filter (where status = 'pending') as pending
    from email_outbox where created_at > now() - interval '24 hours'`);
  const [bev] = await db.execute(sql`select count(*) as n from billing_events where status = 'failed'`);
  const [tickets] = await db.execute(sql`select count(*) as n from support_tickets where status <> 'closed'`);

  return {
    users: { total: n(users?.total), new7d: n(users?.new7d), new30d: n(users?.new30d), suspended: n(users?.suspended), withoutSubscription: n(free?.n) },
    plans: plans.map((p) => ({
      planId: String(p.plan_id),
      name: String(p.name),
      active: n(p.active),
      trialing: n(p.trialing),
      pastDue: n(p.past_due),
    })),
    trials: { started30d: n(trials?.started), converted30d: n(trials?.converted), canceled30d: n(trials?.canceled), inProgress: n(trials?.in_progress), blockedDuplicates30d: n(trials?.blocked) },
    cancellations30d: n(cancel?.n),
    mrrCents: n(mrr?.cents),
    collected30d: { cents: n(collected?.cents), invoices: n(collected?.invoices), liveMode: Boolean(collected?.live) },
    monitors: { page: n(mon?.page), webTopic: n(mon?.web), paused: n(mon?.paused), errors: n(mon?.errors) },
    devices: { total: n(dev?.total), online: n(dev?.online), consented: n(dev?.consented) },
    business: { sites: n(biz?.sites), verified: n(biz?.verified), openIncidents: n(biz?.open_incidents), endpoints: n(biz?.endpoints) },
    jobs24h: { succeeded: n(jobs?.ok), failed: n(jobs?.failed), pending: n(jobs?.pending), oldestPendingMinutes: jobs?.oldest === null || jobs?.oldest === undefined ? null : Math.round(n(jobs.oldest)) },
    workers: workers.map((w) => ({
      workerId: String(w.worker_id),
      hostname: String(w.hostname),
      role: String(w.role),
      lastSeenAt: new Date(w.last_seen_at as string).toISOString(),
      online: Date.now() - new Date(w.last_seen_at as string).getTime() < 120_000,
      succeeded: n(w.jobs_succeeded),
      failed: n(w.jobs_failed),
      loopErrors: recentLoopErrors(w.stats),
    })),
    costs: {
      monthMicros: byProvider.reduce((a, r) => a + n(r.micros), 0),
      budgetEur: n(budget?.eur),
      byProvider: byProvider.map((r) => ({ provider: String(r.provider), units: n(r.units), micros: n(r.micros), cacheHits: n(r.hits) })),
    },
    emails24h: { sent: n(emails?.sent), failed: n(emails?.failed), pending: n(emails?.pending) },
    billingEventsFailed: n(bev?.n),
    openTickets: n(tickets?.n),
  };
}

export interface Anomaly {
  severity: "high" | "medium" | "low";
  title: string;
  detail: string;
}

/** Signaux à surveiller, déduits des données (aucune alerte inventée). */
type LoopStats = { errors?: number; lastError?: string | null; lastErrorAt?: string | null };

/** Erreurs de boucle survenues dans la dernière heure (les compteurs du worker sont cumulés depuis son démarrage). */
export function recentLoopErrors(stats: unknown, now = Date.now()): AdminKpis["workers"][number]["loopErrors"] {
  const loops = (stats as { loops?: Record<string, LoopStats> } | null)?.loops ?? {};
  return Object.entries(loops)
    .filter(([, l]) => (l.errors ?? 0) > 0 && l.lastErrorAt && now - new Date(l.lastErrorAt).getTime() < 3_600_000)
    .map(([loop, l]) => ({ loop, errors: n(l.errors), lastError: l.lastError ?? null, lastErrorAt: l.lastErrorAt! }));
}

export function detectAnomalies(k: AdminKpis): Anomaly[] {
  const out: Anomaly[] = [];
  if (!k.workers.some((w) => w.online)) out.push({ severity: "high", title: "Aucun worker en ligne", detail: "Les contrôles serveur, e-mails et contrôles Business ne s'exécutent pas." });
  if (k.jobs24h.oldestPendingMinutes !== null && k.jobs24h.oldestPendingMinutes > 30)
    out.push({ severity: "high", title: "File de contrôles en retard", detail: `Le plus ancien contrôle en attente date de ${k.jobs24h.oldestPendingMinutes} min.` });
  const total = k.jobs24h.succeeded + k.jobs24h.failed;
  if (total >= 20 && k.jobs24h.failed / total > 0.2)
    out.push({ severity: "medium", title: "Taux d'échec des contrôles élevé", detail: `${k.jobs24h.failed} échecs sur ${total} contrôles en 24 h.` });
  if (k.costs.budgetEur > 0 && k.costs.monthMicros / 1e6 > k.costs.budgetEur * 0.8)
    out.push({ severity: "medium", title: "Budget des API payantes bientôt atteint", detail: `${(k.costs.monthMicros / 1e6).toFixed(2)} € sur ${k.costs.budgetEur} € ce mois-ci.` });
  const loopErrors = k.workers.filter((w) => w.online).flatMap((w) => w.loopErrors);
  if (loopErrors.length)
    out.push({ severity: "medium", title: "Erreurs dans les traitements du worker", detail: loopErrors.map((l) => `${l.loop} : ${l.errors} erreur(s)${l.lastError ? ` — ${l.lastError}` : ""}`).join(" · ").slice(0, 400) });
  if (k.billingEventsFailed > 0) out.push({ severity: "high", title: "Événements Stripe en échec", detail: `${k.billingEventsFailed} événement(s) de facturation non traités.` });
  if (k.emails24h.failed > 0) out.push({ severity: "medium", title: "E-mails en échec", detail: `${k.emails24h.failed} e-mail(s) non envoyés en 24 h.` });
  if (k.trials.blockedDuplicates30d > 5) out.push({ severity: "low", title: "Tentatives d'essais multiples", detail: `${k.trials.blockedDuplicates30d} essais refusés (même e-mail ou même carte) en 30 jours.` });
  if (k.business.openIncidents > 0) out.push({ severity: "low", title: "Incidents Business en cours chez des clients", detail: `${k.business.openIncidents} incident(s) ouvert(s).` });
  return out;
}

export async function searchUsers(q: string, limit = 50) {
  const term = q.trim().toLowerCase().replace(/[%_]/g, "");
  return getDb().execute<{
    id: string;
    email: string;
    display_name: string | null;
    role: string;
    created_at: Date;
    last_seen_at: Date | null;
    suspended_at: Date | null;
    plan_id: string | null;
    sub_status: string | null;
  }>(sql`
    select p.id, p.email, p.display_name, p.role, p.created_at, p.last_seen_at, p.suspended_at, s.plan_id, s.status as sub_status
    from profiles p
    left join lateral (
      select plan_id, status from subscriptions where user_id = p.id order by (status in ('active', 'trialing', 'past_due')) desc, created_at desc limit 1
    ) s on true
    where ${term ? sql`(lower(p.email) like ${`%${term}%`} or p.id::text = ${term})` : sql`true`}
    order by p.created_at desc
    limit ${limit}`);
}

export async function getUserAdminView(userId: string) {
  const db = getDb();
  const [profile] = await db.execute(sql`select * from profiles where id = ${userId}`);
  if (!profile) return null;
  const [subs, ent, monitors, devices, sites, costs, audit, tickets] = await Promise.all([
    db.execute(sql`select plan_id, status, trial_end, current_period_end, cancel_at_period_end, extra_sites, created_at from subscriptions where user_id = ${userId} order by created_at desc`),
    db.execute(sql`select * from entitlements where user_id = ${userId}`),
    db.execute(sql`select kind, status, count(*)::int as n from monitoring_tasks where user_id = ${userId} group by kind, status`),
    db.execute(sql`select name, platform, status, last_seen_at, monitoring_enabled, consent_local_at from agent_devices where user_id = ${userId} order by created_at desc`),
    db.execute(sql`select name, domain, status from business_sites where user_id = ${userId}`),
    db.execute(sql`select provider, sum(units)::int as units, sum(estimated_cost_micros)::bigint as micros from api_usage where user_id = ${userId} and occurred_at > now() - interval '30 days' group by provider`),
    db.execute(sql`select a.*, p.email as admin_email from admin_audit_logs a left join profiles p on p.id = a.admin_id where a.target_type = 'user' and a.target_id = ${userId} order by a.created_at desc limit 50`),
    db.execute(sql`select id, subject, status, created_at from support_tickets where user_id = ${userId} order by created_at desc limit 20`),
  ]);
  return { profile, subs, entitlements: ent[0] ?? null, monitors, devices, sites, costs, audit, tickets };
}

export async function costsByPlan() {
  return getDb().execute<{ plan_id: string | null; users: number; micros: number; units: number }>(sql`
    select coalesce(u.plan_id, 'inconnu') as plan_id, count(distinct u.user_id)::int as users, sum(u.estimated_cost_micros)::bigint as micros, sum(u.units)::int as units
    from api_usage u where u.occurred_at >= date_trunc('month', now())
    group by 1 order by micros desc`);
}

export async function topCostUsers(limit = 20) {
  return getDb().execute<{ user_id: string; email: string | null; micros: number; units: number }>(sql`
    select u.user_id, p.email, sum(u.estimated_cost_micros)::bigint as micros, sum(u.units)::int as units
    from api_usage u left join profiles p on p.id = u.user_id
    where u.occurred_at >= date_trunc('month', now()) and u.user_id is not null
    group by u.user_id, p.email order by micros desc limit ${limit}`);
}

export async function listAudit(limit = 200) {
  return getDb().execute<{ id: number; action: string; target_type: string; target_id: string | null; reason: string | null; created_at: Date; admin_email: string | null; metadata: Record<string, unknown> }>(sql`
    select a.id, a.action, a.target_type, a.target_id, a.reason, a.created_at, a.metadata, p.email as admin_email
    from admin_audit_logs a left join profiles p on p.id = a.admin_id
    order by a.created_at desc limit ${limit}`);
}

export async function listTickets(status: "open" | "pending" | "closed" | "all" = "open") {
  return getDb().execute<{ id: string; email: string; subject: string; category: string; status: string; created_at: Date; updated_at: Date; messages: number }>(sql`
    select t.id, t.email, t.subject, t.category, t.status, t.created_at, t.updated_at, (select count(*)::int from support_messages m where m.ticket_id = t.id) as messages
    from support_tickets t
    where ${status === "all" ? sql`true` : sql`t.status = ${status}`}
    order by t.updated_at desc limit 200`);
}

export async function getTicket(id: string) {
  const db = getDb();
  const [ticket] = await db.execute(sql`select * from support_tickets where id = ${id}`);
  if (!ticket) return null;
  const messages = await db.execute(sql`select id, author, body, created_at from support_messages where ticket_id = ${id} order by created_at, id`);
  return { ticket, messages };
}

export async function audit(db: Executor, entry: { adminId: string; action: string; targetType: string; targetId?: string | null; reason?: string | null; metadata?: Record<string, unknown> }) {
  await db.insert(adminAuditLogs).values({
    adminId: entry.adminId,
    action: entry.action,
    targetType: entry.targetType,
    targetId: entry.targetId ?? null,
    reason: entry.reason ?? null,
    metadata: entry.metadata ?? {},
  });
}
