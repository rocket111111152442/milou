import { describe, expect, it } from "vitest";
import { billingMode, integrationStatus } from "@waverti/config/env";

describe("mode de facturation", () => {
  it("se déduit du préfixe de la clé, sans jamais l'exposer", () => {
    expect(billingMode({})).toBe("absent");
    expect(billingMode({ STRIPE_SECRET_KEY: "sk_test_abc" })).toBe("test");
    expect(billingMode({ STRIPE_SECRET_KEY: "rk_test_abc" })).toBe("test");
    expect(billingMode({ STRIPE_SECRET_KEY: "sk_live_abc" })).toBe("live_blocked");
    expect(billingMode({ STRIPE_SECRET_KEY: "rk_live_abc", WAVERTI_ALLOW_LIVE_PAYMENTS: "yes" })).toBe("live_blocked");
    expect(billingMode({ STRIPE_SECRET_KEY: "sk_live_abc", WAVERTI_ALLOW_LIVE_PAYMENTS: "I_HAVE_LEGAL_APPROVAL" })).toBe("live");
    expect(billingMode({ STRIPE_SECRET_KEY: "pk_test_abc" })).toBe("absent");
  });
  it("une clé live non autorisée rend le paiement indisponible (pas d'erreur 500)", () => {
    expect(integrationStatus({ STRIPE_SECRET_KEY: "sk_live_abc", STRIPE_WEBHOOK_SECRET: "whsec_x" }).stripe).toBe(false);
    expect(integrationStatus({ STRIPE_SECRET_KEY: "sk_test_abc", STRIPE_WEBHOOK_SECRET: "whsec_x" }).stripe).toBe(true);
    expect(integrationStatus({ STRIPE_SECRET_KEY: "sk_test_abc" }).stripe).toBe(false);
  });
});

describe("outils de recette Stripe", () => {
  it("jamais en Production ni avec une clé live, et seulement sur activation explicite", async () => {
    const { testBillingToolsEnabled } = await import("../src/lib/stripe-tools");
    const test = { STRIPE_SECRET_KEY: "sk_test_x", WAVERTI_BILLING_TEST_TOOLS: "1" };
    expect(testBillingToolsEnabled({ ...test, VERCEL_ENV: "preview" })).toBe(true);
    expect(testBillingToolsEnabled({ ...test, VERCEL_ENV: "production" })).toBe(false);
    expect(testBillingToolsEnabled({ ...test, STRIPE_SECRET_KEY: "sk_live_x", VERCEL_ENV: "preview" })).toBe(false);
    expect(testBillingToolsEnabled({ STRIPE_SECRET_KEY: "sk_test_x", VERCEL_ENV: "preview" })).toBe(false);
  });
});
