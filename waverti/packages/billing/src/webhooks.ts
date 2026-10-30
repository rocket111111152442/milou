/**
 * Webhooks Stripe — source de vérité des paiements.
 *  - Signature vérifiée (STRIPE_WEBHOOK_SECRET) avant toute lecture du contenu.
 *  - Idempotence : chaque événement est enregistré par son identifiant ; un événement déjà
 *    traité est acquitté sans être rejoué. Un verrou transactionnel évite le double traitement
 *    de deux livraisons simultanées.
 *  - Désordre des événements : l'abonnement est relu chez Stripe à chaque événement, on applique
 *    donc toujours l'état le plus récent quel que soit l'ordre d'arrivée.
 */
import {
  and,
  eq,
  ne,
  or,
  profiles,
  sql,
  subscriptions,
  trialUsage,
  type Database,
  type Transaction,
} from "@waverti/database";
import { isUuid } from "@waverti/database";
import { normalizeEmailForAbuse, pepperedHash } from "@waverti/auth";
import { notify } from "@waverti/notifications";
import { loadPriceMap } from "./checkout";
import { recomputeEntitlements } from "./store";
import { idOf, normalizeStatus, toDate, type Stripe, type StripeClient } from "./stripe";

export interface WebhookDeps {
  db: Database;
  stripe: StripeClient;
  webhookSecret: string;
  pepper?: string;
  now?: () => Date;
}

export interface WebhookResponse {
  status: number;
  body: Record<string, unknown>;
}

const HANDLED = new Set([
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "customer.subscription.paused",
  "customer.subscription.resumed",
  "customer.subscription.trial_will_end",
  "invoice.paid",
  "invoice.payment_failed",
]);

export async function handleStripeWebhook(deps: WebhookDeps, rawBody: string, signature: string | null): Promise<WebhookResponse> {
  if (!signature) return { status: 400, body: { error: "missing_signature" } };
  let event: Stripe.Event;
  try {
    event = deps.stripe.webhooks.constructEvent(rawBody, signature, deps.webhookSecret);
  } catch {
    return { status: 400, body: { error: "invalid_signature" } };
  }

  try {
    const outcome = await deps.db.transaction(async (tx) => {
      // Verrou par événement : deux livraisons concurrentes du même événement sont sérialisées.
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${event.id}, 42))`);
      const existing = await tx.execute<{ status: string }>(sql`select status from billing_events where id = ${event.id}`);
      const prev = existing[0]?.status;
      if (prev === "processed" || prev === "ignored") return { duplicate: true, status: prev };

      const summary = summarize(event);
      await tx.execute(sql`
        insert into billing_events (id, type, stripe_created_at, status, attempts, summary)
        values (${event.id}, ${event.type}, to_timestamp(${event.created}), 'received', 1, ${JSON.stringify(summary)}::jsonb)
        on conflict (id) do update set attempts = billing_events.attempts + 1, status = 'received', error = null`);

      if (!HANDLED.has(event.type)) {
        await tx.execute(sql`update billing_events set status = 'ignored', processed_at = now() where id = ${event.id}`);
        return { duplicate: false, status: "ignored" };
      }
      const userId = await processEvent(tx, deps, event);
      await tx.execute(
        sql`update billing_events set status = 'processed', processed_at = now(), user_id = ${userId} where id = ${event.id}`,
      );
      return { duplicate: false, status: "processed" };
    });
    return { status: 200, body: { received: true, ...outcome } };
  } catch (err) {
    const message = (err as Error).message?.slice(0, 300) ?? "error";
    // Enregistre l'échec hors de la transaction annulée ; Stripe renverra l'événement.
    await deps.db
      .execute(sql`
        insert into billing_events (id, type, stripe_created_at, status, attempts, error, summary)
        values (${event.id}, ${event.type}, to_timestamp(${event.created}), 'failed', 1, ${message}, '{}'::jsonb)
        on conflict (id) do update set status = 'failed', error = ${message}`)
      .catch(() => undefined);
    return { status: 500, body: { error: "processing_failed" } };
  }
}

/** Extrait minimal conservé (aucune donnée de carte, d'adresse ni de nom). */
function summarize(event: Stripe.Event): Record<string, unknown> {
  const obj = event.data.object as unknown as Record<string, unknown>;
  return {
    object: obj.object,
    id: obj.id,
    status: obj.status ?? null,
    customer: typeof obj.customer === "string" ? obj.customer : null,
    livemode: event.livemode,
    // Montants réellement facturés / encaissés (centimes), pour le suivi du chiffre d'affaires.
    ...(obj.object === "invoice"
      ? { amount_paid: obj.amount_paid ?? null, amount_due: obj.amount_due ?? null, currency: obj.currency ?? null, billing_reason: obj.billing_reason ?? null }
      : {}),
  };
}

async function resolveUserId(tx: Transaction, metadataUserId: string | undefined | null, customerId: string | null): Promise<string | null> {
  if (metadataUserId && isUuid(metadataUserId)) {
    const [p] = await tx.select({ id: profiles.id }).from(profiles).where(eq(profiles.id, metadataUserId)).limit(1);
    if (p) return p.id;
  }
  if (customerId) {
    const [p] = await tx.select({ id: profiles.id }).from(profiles).where(eq(profiles.stripeCustomerId, customerId)).limit(1);
    if (p) return p.id;
  }
  return null;
}

async function processEvent(tx: Transaction, deps: WebhookDeps, event: Stripe.Event): Promise<string | null> {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      if (session.mode !== "subscription") return null;
      const customerId = idOf(session.customer);
      const userId = await resolveUserId(tx, session.client_reference_id ?? session.metadata?.waverti_user_id, customerId);
      if (!userId) throw new Error("checkout: utilisateur introuvable");
      if (customerId) {
        await tx
          .update(profiles)
          .set({ stripeCustomerId: customerId })
          .where(and(eq(profiles.id, userId), sql`stripe_customer_id is null`));
      }
      const subId = idOf(session.subscription);
      if (!subId) return userId;
      const sub = await deps.stripe.subscriptions.retrieve(subId, { expand: ["default_payment_method"] });
      const before = await upsertSubscription(tx, userId, sub);
      const trial = sub.status === "trialing" ? await registerTrial(tx, deps, userId, sub, session) : "none";
      await recomputeEntitlements(tx, userId, deps.now?.());
      if (trial !== "blocked") await notifyTransition(tx, userId, before, sub);
      return userId;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
    case "customer.subscription.paused":
    case "customer.subscription.resumed":
    case "customer.subscription.trial_will_end": {
      const evSub = event.data.object;
      const userId = await resolveUserId(tx, evSub.metadata?.waverti_user_id, idOf(evSub.customer));
      if (!userId) throw new Error("subscription: utilisateur introuvable");
      const sub = await deps.stripe.subscriptions.retrieve(evSub.id);
      const before = await upsertSubscription(tx, userId, sub);
      if (sub.status === "canceled") {
        await tx
          .update(trialUsage)
          .set({ status: "canceled", endedAt: deps.now?.() ?? new Date() })
          .where(and(eq(trialUsage.stripeSubscriptionId, sub.id), eq(trialUsage.status, "started")));
      }
      await recomputeEntitlements(tx, userId, deps.now?.());
      await notifyTransition(tx, userId, before, sub);
      return userId;
    }
    case "invoice.paid":
    case "invoice.payment_failed": {
      const invoice = event.data.object;
      const subRef = invoice.parent?.subscription_details?.subscription ?? null;
      const subId = idOf(subRef as string | { id: string } | null);
      const userId = await resolveUserId(tx, invoice.parent?.subscription_details?.metadata?.waverti_user_id, idOf(invoice.customer));
      if (!userId || !subId) return userId;
      const sub = await deps.stripe.subscriptions.retrieve(subId);
      const before = await upsertSubscription(tx, userId, sub);
      if (event.type === "invoice.paid" && (invoice.amount_paid ?? 0) > 0) {
        await tx
          .update(trialUsage)
          .set({ status: "converted", endedAt: deps.now?.() ?? new Date() })
          .where(and(eq(trialUsage.stripeSubscriptionId, sub.id), eq(trialUsage.status, "started")));
      }
      if (event.type === "invoice.payment_failed") {
        await notify(tx, {
          userId,
          type: "subscription",
          priority: "high",
          title: "Échec du paiement de votre abonnement",
          body: "Le prélèvement n'a pas pu être effectué. Mettez à jour votre moyen de paiement depuis la page Abonnement pour conserver vos fonctionnalités.",
          linkPath: "/app/abonnement",
          dedupKey: `invoice_failed:${invoice.id}`,
          emailPolicy: "transactional",
        });
      }
      await recomputeEntitlements(tx, userId, deps.now?.());
      await notifyTransition(tx, userId, before, sub);
      return userId;
    }
    default:
      return null;
  }
}

interface StoredSub {
  status: string;
  planId: string;
  cancelAtPeriodEnd: boolean;
}

/** Insère ou met à jour l'abonnement à partir de l'objet Stripe (frais). Retourne l'état précédent. */
async function upsertSubscription(tx: Transaction, userId: string, sub: Stripe.Subscription): Promise<StoredSub | null> {
  const priceMap = await loadPriceMap(tx);
  let planId: string | null = null;
  let extraSites = 0;
  let periodStart: number | null = null;
  let periodEnd: number | null = null;
  for (const item of sub.items.data) {
    const priceId = item.price.id;
    const p = priceMap.plans.get(priceId);
    if (p) {
      planId = p;
      periodStart = item.current_period_start;
      periodEnd = item.current_period_end;
    } else if (priceMap.addons.get(priceId) === "business_extra_site") {
      extraSites += item.quantity ?? 0;
    }
  }
  planId ??= sub.metadata?.plan_id ?? null;
  if (!planId) throw new Error(`subscription ${sub.id}: formule inconnue`);

  const [prev] = await tx
    .select({ status: subscriptions.status, planId: subscriptions.planId, cancelAtPeriodEnd: subscriptions.cancelAtPeriodEnd })
    .from(subscriptions)
    .where(eq(subscriptions.stripeSubscriptionId, sub.id))
    .limit(1);

  const values = {
    userId,
    planId,
    stripeSubscriptionId: sub.id,
    stripeCustomerId: idOf(sub.customer)!,
    status: normalizeStatus(sub.status),
    extraSites,
    trialStart: toDate(sub.trial_start),
    trialEnd: toDate(sub.trial_end),
    currentPeriodStart: toDate(periodStart),
    currentPeriodEnd: toDate(periodEnd),
    cancelAtPeriodEnd: sub.cancel_at_period_end,
    canceledAt: toDate(sub.canceled_at),
    endedAt: toDate(sub.ended_at),
    lastEventAt: new Date(),
  };
  await tx.insert(subscriptions).values(values).onConflictDoUpdate({ target: subscriptions.stripeSubscriptionId, set: values });
  return prev ?? null;
}

/** Anti-abus : un essai par e-mail normalisé et par carte (empreintes HMAC, jamais en clair). */
async function registerTrial(
  tx: Transaction,
  deps: WebhookDeps,
  userId: string,
  sub: Stripe.Subscription,
  session: Stripe.Checkout.Session,
): Promise<"started" | "blocked" | "existing"> {
  const [already] = await tx.select({ id: trialUsage.id }).from(trialUsage).where(eq(trialUsage.stripeSubscriptionId, sub.id)).limit(1);
  if (already) return "existing";
  const [profile] = await tx.select({ email: profiles.email }).from(profiles).where(eq(profiles.id, userId)).limit(1);
  const emailHash = pepperedHash(normalizeEmailForAbuse(profile?.email ?? session.customer_details?.email ?? ""), deps.pepper);

  let fingerprint: string | null = null;
  const pm = sub.default_payment_method;
  if (pm && typeof pm !== "string") fingerprint = pm.card?.fingerprint ?? null;
  else if (typeof pm === "string") {
    const full = await deps.stripe.paymentMethods.retrieve(pm);
    fingerprint = full.card?.fingerprint ?? null;
  }
  const cardHash = fingerprint ? pepperedHash(`card:${fingerprint}`, deps.pepper) : null;

  const dupConditions = [eq(trialUsage.emailHash, emailHash), eq(trialUsage.userId, userId)];
  if (cardHash) dupConditions.push(eq(trialUsage.cardFingerprintHash, cardHash));
  const [dup] = await tx
    .select({ id: trialUsage.id })
    .from(trialUsage)
    .where(and(or(...dupConditions), ne(trialUsage.status, "blocked_duplicate")))
    .limit(1);

  if (dup) {
    await tx.insert(trialUsage).values({
      userId,
      emailHash,
      cardFingerprintHash: cardHash,
      planId: sub.metadata?.plan_id ?? "plus",
      stripeSubscriptionId: sub.id,
      status: "blocked_duplicate",
      endedAt: new Date(),
    });
    // Annulation immédiate pendant l'essai : aucun prélèvement n'a lieu.
    const canceled = await deps.stripe.subscriptions.cancel(sub.id, { invoice_now: false, prorate: false });
    await upsertSubscription(tx, userId, canceled);
    await notify(tx, {
      userId,
      type: "trial",
      priority: "high",
      title: "Essai gratuit déjà utilisé",
      body: "Un essai gratuit a déjà été utilisé avec cette adresse ou ce moyen de paiement. L'abonnement d'essai a été annulé sans aucun prélèvement. Vous pouvez souscrire sans essai depuis la page Abonnement.",
      linkPath: "/app/abonnement",
      dedupKey: `trial_blocked:${sub.id}`,
      emailPolicy: "transactional",
    });
    return "blocked";
  }
  await tx
    .insert(trialUsage)
    .values({
      userId,
      emailHash,
      cardFingerprintHash: cardHash,
      planId: sub.metadata?.plan_id ?? "plus",
      stripeSubscriptionId: sub.id,
      status: "started",
    })
    .onConflictDoNothing();
  return "started";
}

const PLAN_NAMES: Record<string, string> = { plus: "Plus", pro: "Pro", business: "Business" };

async function notifyTransition(tx: Transaction, userId: string, before: StoredSub | null, sub: Stripe.Subscription): Promise<void> {
  const now = sub.status;
  const planId = sub.metadata?.plan_id ?? before?.planId ?? "";
  const plan = PLAN_NAMES[planId] ?? "payante";
  const trialEnd = toDate(sub.trial_end);
  const when = (d: Date | null) =>
    d ? d.toLocaleString("fr-FR", { timeZone: "Europe/Paris", dateStyle: "long", timeStyle: "short" }) : "—";
  if (now === "trialing" && before?.status !== "trialing") {
    await notify(tx, {
      userId,
      type: "trial",
      title: `Votre essai Waverti ${plan} a commencé`,
      body: `Votre essai gratuit de 72 heures est actif. Sans résiliation, le premier prélèvement aura lieu le ${when(trialEnd)}. Vous pouvez résilier à tout moment depuis la page Abonnement.`,
      linkPath: "/app/abonnement",
      dedupKey: `trial_started:${sub.id}`,
      emailPolicy: "transactional",
    });
  } else if (now === "active" && before?.status === "trialing") {
    await notify(tx, {
      userId,
      type: "subscription",
      title: `Abonnement ${plan} activé`,
      body: "Votre paiement a été accepté : les quotas complets de votre formule sont maintenant disponibles.",
      linkPath: "/app/abonnement",
      dedupKey: `activated:${sub.id}`,
      emailPolicy: "transactional",
    });
  } else if (now === "canceled" && before && before.status !== "canceled") {
    await notify(tx, {
      userId,
      type: "subscription",
      title: "Votre abonnement est terminé",
      body: "Votre compte est repassé en formule Découverte. Vos surveillances au-delà des limites gratuites ont été mises en pause, rien n'a été supprimé.",
      linkPath: "/app/abonnement",
      dedupKey: `canceled:${sub.id}`,
      emailPolicy: "transactional",
    });
  } else if (sub.cancel_at_period_end && before && !before.cancelAtPeriodEnd) {
    await notify(tx, {
      userId,
      type: "subscription",
      title: "Résiliation enregistrée",
      body:
        now === "trialing"
          ? `Votre essai se terminera le ${when(trialEnd)} et aucun prélèvement ne sera effectué.`
          : "Votre abonnement restera actif jusqu'à la fin de la période déjà payée, puis ne sera pas renouvelé.",
      linkPath: "/app/abonnement",
      dedupKey: `cancel_scheduled:${sub.id}:${sub.canceled_at ?? sub.cancel_at ?? "x"}`,
      emailPolicy: "transactional",
    });
  }
}
