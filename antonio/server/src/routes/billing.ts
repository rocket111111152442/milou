import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { PLAN_IDS, OFFERS } from "@antonio/shared";
import { actorOf } from "../app.js";
import { config, providerConfigured } from "../config.js";
import { db, schema } from "../db/client.js";
import { AppError } from "../lib/audit.js";
import { billingEnabled, checkoutFor, stripeClient, subscriptionFor, refreshSubscription } from "../billing/service.js";

export async function billingRoutes(app: FastifyInstance) {
  app.get("/api/public/status", async () => ({ billingEnabled: billingEnabled(), offers: OFFERS, services: { ai: providerConfigured("openai"), voice: providerConfigured("openai"), google: providerConfigured("google"), microsoft: providerConfigured("microsoft"), automationApi: true } }));
  app.get("/api/billing", async (req) => {
    const user = actorOf(req);
    const row = await subscriptionFor(user.userId);
    return { enabled: billingEnabled(), offers: OFFERS, subscription: row ? { requestedPlan: row.requestedPlan, plan: row.plan, status: row.status, cancelAtPeriodEnd: row.cancelAtPeriodEnd, hasCustomer: Boolean(row.stripeCustomerId) } : null };
  });
  app.put("/api/billing/preference", async (req) => {
    const user = actorOf(req);
    const { plan } = z.object({ plan: z.enum(PLAN_IDS) }).parse(req.body);
    await db().insert(schema.subscriptions).values({ userId: user.userId, requestedPlan: plan }).onConflictDoUpdate({ target: schema.subscriptions.userId, set: { requestedPlan: plan, updatedAt: new Date() } });
    return { ok: true };
  });
  app.post("/api/billing/checkout", { config: { rateLimit: { max: 5, timeWindow: "1 minute" } } }, async (req) => {
    const { plan, requestId } = z.object({ plan: z.enum(PLAN_IDS), requestId: z.string().uuid() }).parse(req.body);
    return checkoutFor(actorOf(req), plan, requestId);
  });
  app.post("/api/billing/confirm", async (req) => {
    const user = actorOf(req);
    if (!billingEnabled()) throw new AppError(503, "billing_unavailable", "La facturation n’est pas activée.");
    const { sessionId } = z.object({ sessionId: z.string().startsWith("cs_").max(250) }).parse(req.body);
    const session = await stripeClient().checkout.sessions.retrieve(sessionId);
    if (session.client_reference_id !== user.userId) throw new AppError(404, "not_found", "Session de paiement inconnue.");
    if (session.status !== "complete" || !session.subscription) return { confirmed: false };
    await refreshSubscription(typeof session.subscription === "string" ? session.subscription : session.subscription.id);
    return { confirmed: true };
  });
  app.post("/api/billing/portal", async (req) => {
    const user = actorOf(req);
    const row = await subscriptionFor(user.userId);
    if (!row?.stripeCustomerId || !billingEnabled()) throw new AppError(400, "no_customer", "Aucun abonnement à gérer pour ce compte.");
    return stripeClient().billingPortal.sessions.create({ customer: row.stripeCustomerId, return_url: `${config().APP_BASE_URL}/abonnement`, locale: "fr" });
  });
  await app.register(async (hook) => {
    hook.removeContentTypeParser("application/json");
    hook.addContentTypeParser("application/json", { parseAs: "buffer" }, (_req, body, done) => done(null, body));
    hook.post("/api/webhooks/stripe", async (req, reply) => {
      if (!config().STRIPE_WEBHOOK_SECRET) throw new AppError(503, "billing_unavailable", "Webhook non configuré.");
      const signature = req.headers["stripe-signature"];
      if (typeof signature !== "string") throw new AppError(400, "bad_signature", "Signature manquante.");
      let event;
      try { event = stripeClient().webhooks.constructEvent(req.body as Buffer, signature, config().STRIPE_WEBHOOK_SECRET!); }
      catch { throw new AppError(400, "bad_signature", "Signature Stripe invalide."); }
      const [seen] = await db().select().from(schema.billingEvents).where(eq(schema.billingEvents.id, event.id));
      if (seen) return reply.send({ received: true });
      if (["customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"].includes(event.type)) await refreshSubscription((event.data.object as { id: string }).id);
      if (event.type === "checkout.session.completed") {
        const object = event.data.object as { subscription: string | { id: string } | null };
        if (object.subscription) await refreshSubscription(typeof object.subscription === "string" ? object.subscription : object.subscription.id);
      }
      await db().insert(schema.billingEvents).values({ id: event.id }).onConflictDoNothing();
      return { received: true };
    });
  });
}
