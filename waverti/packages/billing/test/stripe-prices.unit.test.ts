import { describe, expect, it } from "vitest";
import { checkPrice } from "../src/prices";
import { PAID_PLAN_IDS, PLAN_CATALOG } from "../src/catalog";

const price = (over: Record<string, unknown> = {}) =>
  ({ id: "price_max", active: true, currency: "eur", type: "recurring", unit_amount: 2999, tax_behavior: "inclusive", recurring: { interval: "month", interval_count: 1, usage_type: "licensed" }, ...over }) as never;

describe("contrôle des prix Stripe avant paiement", () => {
  it("quatre formules, clés de recherche et montants du catalogue", () => {
    expect(PAID_PLAN_IDS.map((id) => [PLAN_CATALOG[id].stripeLookupKey, PLAN_CATALOG[id].priceCents])).toEqual([
      ["waverti_plus_monthly", 599],
      ["waverti_pro_monthly", 1499],
      ["waverti_max_monthly", 2999],
      ["waverti_business_monthly", 3999],
    ]);
  });
  it("accepte un prix conforme (EUR, mensuel, montant exact, TTC ou non précisé)", () => {
    expect(checkPrice("max", price())).toMatchObject({ ok: true, priceId: "price_max", issues: [] });
    expect(checkPrice("max", price({ tax_behavior: "unspecified" })).ok).toBe(true);
  });
  it("refuse tout écart : montant, devise, périodicité, archivage, hors taxes, absent", () => {
    const bad = checkPrice("max", price({ unit_amount: 2900, currency: "usd", active: false, tax_behavior: "exclusive", recurring: { interval: "year", interval_count: 1 } }));
    expect(bad.ok).toBe(false);
    expect(bad.issues).toHaveLength(5);
    expect(checkPrice("max", price({ type: "one_time", recurring: null })).ok).toBe(false);
    expect(checkPrice("plus", undefined)).toMatchObject({ ok: false, priceId: null });
  });
});

describe("adaptateur stripe-mock", () => {
  it("ne s'active que pour un hôte local, jamais en production", async () => {
    const { isLocalStripeMock } = await import("../src/stripe-mock");
    expect(isLocalStripeMock("http://localhost:12111", {})).toBe(true);
    expect(isLocalStripeMock("http://127.0.0.1:12111", {})).toBe(true);
    expect(isLocalStripeMock(undefined, {})).toBe(false);
    expect(isLocalStripeMock("https://api.stripe.com", {})).toBe(false);
    expect(isLocalStripeMock("http://localhost:12111", { VERCEL_ENV: "production" })).toBe(false);
  });
});
