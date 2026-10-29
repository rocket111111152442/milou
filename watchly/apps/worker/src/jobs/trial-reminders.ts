import { sql } from "@watchly/database";
import { notify } from "@watchly/notifications";
import { formatCents, formatDateTime } from "@watchly/types";
import type { WorkerContext } from "../context";

/** Rappel avant le premier prélèvement (environ 24 h avant la fin de l'essai de 72 h). */
export async function sendTrialReminders(ctx: WorkerContext): Promise<number> {
  const due = await ctx.db.execute<{ id: string; user_id: string; trial_end: string; plan_name: string; price_cents: number; timezone: string }>(sql`
    select s.id, s.user_id, s.trial_end::text as trial_end, p.name as plan_name, p.price_cents, pr.timezone
    from subscriptions s
    join plans p on p.id = s.plan_id
    join profiles pr on pr.id = s.user_id
    where s.status = 'trialing' and not s.cancel_at_period_end and s.trial_reminder_sent_at is null
      and s.trial_end > now() and s.trial_end <= now() + interval '26 hours'
    limit 200`);
  for (const s of due) {
    await ctx.db.transaction(async (tx) => {
      const when = formatDateTime(new Date(s.trial_end), s.timezone);
      await notify(tx, {
        userId: s.user_id,
        type: "trial",
        priority: "high",
        title: `Votre essai ${s.plan_name} se termine le ${when}`,
        body: `Sans résiliation de votre part, ${formatCents(s.price_cents)} seront prélevés le ${when}, puis chaque mois. Pour ne pas être prélevé, résiliez avant cette date depuis la page Abonnement.`,
        linkPath: "/app/abonnement",
        dedupKey: `trial_reminder:${s.id}`,
        emailPolicy: "transactional",
        emailPayload: { ctaLabel: "Gérer mon abonnement" },
      });
      await tx.execute(sql`update subscriptions set trial_reminder_sent_at = now() where id = ${s.id}`);
    });
  }
  return due.length;
}
