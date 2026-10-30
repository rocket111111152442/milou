import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDatabase, createTestUser, type TestDatabase } from "@watchly/database/testing";
import { notify } from "../src/notify";

let t: TestDatabase;
beforeAll(async () => {
  t = await createTestDatabase();
});
afterAll(async () => {
  await t?.drop();
});

/** Droits minimaux pour un utilisateur de test (alertes e-mail incluses, quota mensuel donné). */
async function grant(userId: string, monthlyEmailAlerts: number) {
  await t.client`
    insert into entitlements (user_id, plan_id, source, max_monitors, max_web_topics, page_interval_minutes, cloud_relay, email_alerts,
      history_days, advanced_history, data_exports, monthly_search_calls, monthly_email_alerts, business_sites, business_endpoints_per_site,
      business_http_interval_seconds, business_scenarios_per_site, business_scenario_interval_minutes, business_tls_checks, priority_alerts)
    values (${userId}, 'plus', 'subscription', 20, 3, 360, true, true, 90, false, false, 90, ${monthlyEmailAlerts}, 0, 0, 60, 0, 120, false, false)`;
}

describe("quota mensuel d'alertes e-mail", () => {
  it("envoie au plus N e-mails par mois ; les alertes restent visibles dans l'application", async () => {
    const u = await createTestUser(t);
    await grant(u.id, 2);
    const results = [];
    for (let i = 0; i < 4; i++) {
      results.push(await notify(t.db, { userId: u.id, type: "price", title: `Prix en baisse ${i}`, body: "119 €", dedupKey: `price:${i}` }));
    }
    expect(results.map((r) => r?.email)).toEqual(["pending", "pending", "skipped", "skipped"]);
    expect(results[2]?.emailQuotaReached).toBe(true);
    const outbox = await t.client`select 1 from email_outbox where user_id = ${u.id}`;
    expect(outbox).toHaveLength(2);
    const inApp = await t.client<{ title: string }[]>`select title from notifications where user_id = ${u.id} order by created_at`;
    expect(inApp.filter((n) => n.title.startsWith("Prix en baisse"))).toHaveLength(4);
    // Une seule information « quota atteint » par mois.
    expect(inApp.filter((n) => n.title.startsWith("Quota d'alertes e-mail"))).toHaveLength(1);
  });

  it("un doublon ne consomme pas le quota", async () => {
    const u = await createTestUser(t);
    await grant(u.id, 1);
    await notify(t.db, { userId: u.id, type: "price", title: "A", body: "x", dedupKey: "same" });
    expect(await notify(t.db, { userId: u.id, type: "price", title: "A", body: "x", dedupKey: "same" })).toBeNull();
    const second = await notify(t.db, { userId: u.id, type: "stock", title: "B", body: "y", dedupKey: "other" });
    expect(second?.email).toBe("skipped");
  });

  it("les alertes de panne Business ne sont jamais bloquées par le quota", async () => {
    const u = await createTestUser(t);
    await grant(u.id, 0);
    const down = await notify(t.db, { userId: u.id, type: "business_down", priority: "critical", title: "Site indisponible", body: "502", dedupKey: "inc:1" });
    expect(down?.email).toBe("pending");
  });
});
