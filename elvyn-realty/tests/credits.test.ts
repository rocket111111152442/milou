import { beforeAll, describe, expect, it, vi } from "vitest";
import Stripe from "stripe";

/** Assistant tokens: percentage only, exhaustion blocks the assistant, Stripe top-ups add 40 %. */
let credits: typeof import("@/lib/ai/credits");
let usage: typeof import("@/lib/ai/usage");
const WEBHOOK_SECRET = "whsec_test_not_a_real_secret";

beforeAll(async () => {
  vi.resetModules();
  process.env.AI_CREDIT_INITIAL_USD = "15";
  process.env.AI_CREDIT_SHARE = "0.4";
  process.env.STRIPE_SECRET_KEY = "sk_test_dummy_not_used_for_network";
  process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET;
  credits = await import("@/lib/ai/credits");
  usage = await import("@/lib/ai/usage");
});

async function spend(usd: number) {
  const { getDb, schema } = await import("@/lib/db");
  const db = await getDb();
  await db.insert(schema.aiUsage).values({ day: new Date().toISOString().slice(0, 10), sessionId: null, model: "gpt-5.4", costUsd: usd, outcome: "ok" });
}

function signedRequest(event: unknown) {
  const payload = JSON.stringify(event);
  const header = Stripe.webhooks.generateTestHeaderString({ payload, secret: WEBHOOK_SECRET });
  return new Request("http://localhost:3000/api/stripe/webhook", { method: "POST", body: payload, headers: { "stripe-signature": header, "content-type": "application/json" } });
}
const paidEvent = (id: string, amountTotal: number) => ({
  id: `evt_${id}`,
  object: "event",
  type: "checkout.session.completed",
  data: { object: { id, object: "checkout.session", metadata: { purpose: "ai_credits" }, payment_status: "paid", amount_total: amountTotal, currency: "eur" } },
});

describe("assistant credits", () => {
  it("starts at 100 % with the initial credit", async () => {
    const s = await credits.creditStatus();
    expect(s.percentLeft).toBe(100);
    expect(s.exhausted).toBe(false);
  });

  it("decreases with usage and reports a percentage", async () => {
    await spend(3.75); // 25 % of 15
    const s = await credits.creditStatus();
    expect(s.percentLeft).toBe(75);
  });

  it("blocks the assistant when exhausted", async () => {
    await spend(11.25);
    const s = await credits.creditStatus();
    expect(s.exhausted).toBe(true);
    expect(s.percentLeft).toBe(0);
    expect(await usage.budgetBlock()).toBe("credits_exhausted");
  });

  it("rejects an unsigned or forged webhook", async () => {
    const { POST } = await import("@/app/api/stripe/webhook/route");
    const forged = new Request("http://localhost:3000/api/stripe/webhook", { method: "POST", body: JSON.stringify(paidEvent("cs_forged", 2000)), headers: { "stripe-signature": "t=1,v1=bad" } });
    expect((await POST(forged as never)).status).toBe(400);
    expect((await credits.creditStatus()).exhausted).toBe(true);
  });

  it("adds 40 % of a paid top-up once (20 € → 8 of credit), idempotent on retries", async () => {
    const { POST } = await import("@/app/api/stripe/webhook/route");
    expect((await POST(signedRequest(paidEvent("cs_test_1", 2000)) as never)).status).toBe(200);
    expect((await POST(signedRequest(paidEvent("cs_test_1", 2000)) as never)).status).toBe(200); // Stripe retry
    const { getDb, schema } = await import("@/lib/db");
    const rows = (await (await getDb()).select().from(schema.aiCredits)).filter((r) => r.kind === "purchase");
    expect(rows).toHaveLength(1);
    expect(rows[0].amountUsd).toBe(8);
    expect(rows[0].paidAmount).toBe(20);
    const s = await credits.creditStatus();
    expect(s.exhausted).toBe(false);
    expect(s.percentLeft).toBe(100);
    expect(await usage.budgetBlock()).toBeNull();
    const h = await credits.purchaseHistory();
    expect(h[0]).toMatchObject({ paidAmount: 20, paidCurrency: "EUR" });
    expect(Object.keys(h[0])).not.toContain("amountUsd");
  });

  it("ignores unpaid or unrelated sessions", async () => {
    const { POST } = await import("@/app/api/stripe/webhook/route");
    const unpaid = paidEvent("cs_test_2", 5000);
    (unpaid.data.object as Record<string, unknown>).payment_status = "unpaid";
    await POST(signedRequest(unpaid) as never);
    const other = paidEvent("cs_test_3", 5000);
    (other.data.object as Record<string, unknown>).metadata = {};
    await POST(signedRequest(other) as never);
    const { getDb, schema } = await import("@/lib/db");
    expect((await (await getDb()).select().from(schema.aiCredits)).filter((r) => r.kind === "purchase")).toHaveLength(1);
  });

  it("validates top-up amounts", async () => {
    const { validTopUpAmount } = await import("@/lib/payments/stripe");
    expect(validTopUpAmount(20)).toBe(20);
    expect(validTopUpAmount("50")).toBe(50);
    expect(validTopUpAmount(5)).toBeNull();
    expect(validTopUpAmount(20.5)).toBeNull();
    expect(validTopUpAmount(100000)).toBeNull();
    expect(validTopUpAmount("abc")).toBeNull();
  });

  it("refuses checkout without an admin session", async () => {
    vi.doMock("@/lib/auth/server", () => ({ getAdmin: async () => null }));
    const { POST } = await import("@/app/api/stripe/checkout/route");
    const res = await POST(new Request("http://localhost:3000/api/stripe/checkout", { method: "POST", body: JSON.stringify({ amount: 20 }) }) as never);
    expect(res.status).toBe(401);
    vi.doUnmock("@/lib/auth/server");
  });
});
