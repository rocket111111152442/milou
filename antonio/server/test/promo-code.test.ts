import { describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";
import { ensureSubscriptionPromoCode } from "../src/billing/service.js";

/** Faux client Stripe minimal : codes promo et coupons en mémoire. */
function fakeStripe(initial: { promos?: { id: string; code: string; active: boolean; coupon: Partial<Stripe.Coupon> }[]; coupons?: Partial<Stripe.Coupon>[] }) {
  const promos = [...(initial.promos ?? [])];
  const coupons = new Map((initial.coupons ?? []).map((c) => [c.id!, c]));
  const stripe = {
    promotionCodes: {
      list: vi.fn(async (p: { code: string; active?: boolean }) => ({
        data: promos.filter((x) => x.code === p.code && (p.active === undefined || x.active === p.active)).map((x) => ({ ...x, promotion: { type: "coupon", coupon: x.coupon } })),
      })),
      update: vi.fn(async (id: string, p: { active: boolean }) => { promos.find((x) => x.id === id)!.active = p.active; return {}; }),
      create: vi.fn(async (p: { code: string; promotion: { coupon: string } }) => { promos.push({ id: `promo_${promos.length}`, code: p.code, active: true, coupon: coupons.get(p.promotion.coupon)! }); return {}; }),
    },
    coupons: {
      retrieve: vi.fn(async (id: string) => { const c = coupons.get(id); if (!c) throw Object.assign(new Error("missing"), { code: "resource_missing" }); return c; }),
      create: vi.fn(async (p: Partial<Stripe.Coupon>) => { coupons.set(p.id!, p); return p; }),
    },
  };
  return { stripe: stripe as unknown as Stripe, promos, raw: stripe };
}

describe("Code paffpaffouiouipaff", () => {
  it("remplace l'ancien code « premier mois offert » par un code 100 % gratuit pour toujours", async () => {
    const { stripe, promos } = fakeStripe({ promos: [{ id: "promo_old", code: "paffpaffouiouipaff", active: true, coupon: { id: "waverti-first-month-100", percent_off: 100, duration: "once" } }] });
    await ensureSubscriptionPromoCode(stripe);
    expect(promos.find((p) => p.id === "promo_old")!.active).toBe(false);
    const active = promos.filter((p) => p.active && p.code === "paffpaffouiouipaff");
    expect(active).toHaveLength(1);
    expect(active[0].coupon).toMatchObject({ percent_off: 100, duration: "forever" });
  });

  it("ne recrée rien quand le code gratuit pour toujours existe déjà", async () => {
    const { stripe, raw } = fakeStripe({ promos: [{ id: "promo_ok", code: "paffpaffouiouipaff", active: true, coupon: { id: "waverti-free-forever-100", percent_off: 100, duration: "forever" } }] });
    await ensureSubscriptionPromoCode(stripe);
    expect(raw.promotionCodes.create).not.toHaveBeenCalled();
    expect(raw.promotionCodes.update).not.toHaveBeenCalled();
  });
});
