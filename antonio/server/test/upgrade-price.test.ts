import { describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";
import { usablePlanPrice } from "../src/billing/service.js";

function fake(found: Partial<Stripe.Price> | null) {
  const created = { id: "price_new", unit_amount: 4900 };
  const stripe = {
    prices: {
      list: vi.fn(async () => ({ data: found ? [found] : [] })),
      create: vi.fn(async () => created),
    },
  };
  return { stripe: stripe as unknown as Stripe, raw: stripe, created };
}

describe("Prix de l'offre supérieure", () => {
  it("remplace un prix dont le produit a été archivé dans Stripe", async () => {
    const { stripe, raw } = fake({ id: "price_old", unit_amount: 4900, product: { id: "prod_old", active: false } as Stripe.Product });
    const price = await usablePlanPrice(stripe, "pro");
    expect(price.id).toBe("price_new");
    expect(raw.prices.create).toHaveBeenCalledWith(expect.objectContaining({ lookup_key: "waverti_pro_monthly", transfer_lookup_key: true, unit_amount: 4900 }), expect.anything());
  });
  it("réutilise un prix valide", async () => {
    const { stripe, raw } = fake({ id: "price_ok", unit_amount: 4900, product: { id: "prod_ok", active: true } as Stripe.Product });
    expect((await usablePlanPrice(stripe, "pro")).id).toBe("price_ok");
    expect(raw.prices.create).not.toHaveBeenCalled();
  });
  it("crée le prix s'il n'existe pas", async () => {
    const { stripe } = fake(null);
    expect((await usablePlanPrice(stripe, "pro")).id).toBe("price_new");
  });
});
