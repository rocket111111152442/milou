import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDatabase, type TestDatabase } from "@waverti/database/testing";
import { PAID_PLAN_IDS, PLAN_CATALOG, RETIRED_STRIPE_LOOKUP_KEYS } from "../src/catalog";

let t: TestDatabase;
beforeAll(async () => {
  t = await createTestDatabase();
});
afterAll(async () => {
  await t?.drop();
});

describe("catalogue affiché = formules en base", () => {
  it("chaque formule de la base correspond au catalogue (prix, quotas, clés Stripe)", async () => {
    const rows = await t.client<Record<string, number | string | boolean | null>[]>`select * from plans order by sort_order`;
    expect(rows.map((r) => r.id)).toEqual(Object.values(PLAN_CATALOG).sort((a, b) => a.sortOrder - b.sortOrder).map((p) => p.id));
    for (const r of rows) {
      const c = PLAN_CATALOG[r.id as keyof typeof PLAN_CATALOG];
      expect(
        [r.price_cents, r.max_monitors, r.max_web_topics, r.page_interval_minutes, r.web_interval_minutes, r.monthly_email_alerts, r.monthly_search_calls, r.business_sites_included, r.business_scenarios_per_site, r.history_days, r.trial_max_monitors, r.trial_email_alerts, r.stripe_lookup_key],
        String(r.id),
      ).toEqual([
        c.priceCents, c.maxMonitors, c.maxWebTopics, c.pageIntervalMinutes, c.webIntervalMinutes, c.monthlyEmailAlerts, c.monthlySearchCalls, c.businessSitesIncluded, c.businessScenariosPerSite, c.historyDays, c.trialMaxMonitors, c.trialEmailAlerts, c.stripeLookupKey,
      ]);
    }
  });

  it("quatre formules uniquement ; l'ancienne option site supplémentaire n'est plus proposée (données conservées)", async () => {
    expect(PAID_PLAN_IDS).toEqual(["plus", "pro", "max", "business"]);
    const [a] = await t.client<{ is_public: boolean }[]>`select is_public from plan_addons where id = 'business_extra_site'`;
    expect(a).toEqual({ is_public: false });
    expect(RETIRED_STRIPE_LOOKUP_KEYS).toEqual(["waverti_business_extra_site_monthly"]);
    expect(Object.values(PLAN_CATALOG).map((p) => p.stripeLookupKey)).not.toContain("waverti_business_extra_site_monthly");
  });
});
