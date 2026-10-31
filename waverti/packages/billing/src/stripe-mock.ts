/**
 * stripe-mock (tests locaux uniquement) ne connaît pas nos clés de recherche et renvoie un prix générique
 * en USD. Cet adaptateur renvoie, pour chaque clé de recherche du catalogue, un prix conforme (EUR, mensuel,
 * montant du catalogue) afin que les parcours E2E passent par le même contrôle de prix qu'en réel.
 * Il n'est activé que pour un hôte local : il ne peut jamais s'appliquer à l'API Stripe réelle.
 */
import { PAID_PLAN_IDS, PLAN_CATALOG } from "./catalog";
import type { Stripe, StripeClient } from "./stripe";

export function isLocalStripeMock(apiBase: string | undefined, env: Record<string, string | undefined> = process.env): boolean {
  if (!apiBase || env.VERCEL_ENV === "production") return false;
  try {
    const host = new URL(apiBase).hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "::1";
  } catch {
    return false;
  }
}

export function withMockCatalogPrices(stripe: StripeClient): StripeClient {
  const real = stripe.prices.list.bind(stripe.prices);
  stripe.prices.list = (async (params?: Stripe.PriceListParams) => {
    const r = await real(params);
    const keys = params?.lookup_keys ?? [];
    const data = PAID_PLAN_IDS.filter((id) => keys.includes(PLAN_CATALOG[id].stripeLookupKey)).map(
      (id) =>
        ({
          ...r.data[0]!,
          id: `price_mock_${id}`,
          active: true,
          currency: "eur",
          type: "recurring",
          unit_amount: PLAN_CATALOG[id].priceCents,
          tax_behavior: "inclusive",
          lookup_key: PLAN_CATALOG[id].stripeLookupKey,
          recurring: { ...r.data[0]!.recurring!, interval: "month", interval_count: 1, usage_type: "licensed" },
        }) as Stripe.Price,
    );
    return { ...r, data: keys.length ? data : r.data };
  }) as typeof stripe.prices.list;
  return stripe;
}
