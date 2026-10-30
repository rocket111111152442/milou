import { describe, expect, it } from "vitest";
import { EXPECTED_PRICES, priceProblems } from "../scripts/stripe-prices";

const base = { unit_amount: 2999, currency: "eur", recurring: { interval: "month", interval_count: 1 }, active: true, tax_behavior: "inclusive" } as const;

describe("vérification des prix Stripe", () => {
  it("attend un prix par formule et pour le site supplémentaire, avec des clés de recherche stables", () => {
    expect(EXPECTED_PRICES.map((e) => [e.env, e.lookupKey, e.amount])).toEqual([
      ["STRIPE_PRICE_PLUS", "waverti_plus_monthly", 599],
      ["STRIPE_PRICE_PRO", "waverti_pro_monthly", 1499],
      ["STRIPE_PRICE_MAX", "waverti_max_monthly", 2999],
      ["STRIPE_PRICE_BUSINESS", "waverti_business_monthly", 3999],
      ["STRIPE_PRICE_BUSINESS_EXTRA_SITE", "waverti_business_extra_site_monthly", 1499],
    ]);
  });

  it("signale tout écart avec le catalogue (montant, devise, périodicité, TTC, archivage)", () => {
    const max = EXPECTED_PRICES.find((e) => e.lookupKey === "waverti_max_monthly")!;
    expect(priceProblems(base as never, max)).toEqual([]);
    const wrong = { ...base, unit_amount: 2900, currency: "usd", recurring: { interval: "year", interval_count: 1 }, active: false, tax_behavior: "exclusive" };
    expect(priceProblems(wrong as never, max)).toHaveLength(5);
  });
});
