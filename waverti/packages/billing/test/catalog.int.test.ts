import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDatabase, type TestDatabase } from "@waverti/database/testing";
import { EXTRA_SITE_ADDON, PLAN_CATALOG } from "../src/catalog";

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

  it("site supplémentaire Business à 14,99 €", async () => {
    const [a] = await t.client<{ price_cents: number; requires_plan_id: string; stripe_lookup_key: string }[]>`
      select price_cents, requires_plan_id, stripe_lookup_key from plan_addons where id = ${EXTRA_SITE_ADDON.id}`;
    expect(a).toEqual({ price_cents: 1499, requires_plan_id: "business", stripe_lookup_key: EXTRA_SITE_ADDON.stripeLookupKey });
  });
});
