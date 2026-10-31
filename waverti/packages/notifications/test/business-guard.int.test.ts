import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDatabase, createTestUser, type TestDatabase } from "@waverti/database/testing";
import { notify } from "../src/notify";

let t: TestDatabase;
beforeAll(async () => {
  t = await createTestDatabase();
});
afterAll(async () => {
  await t?.drop();
});

async function businessUser(monthlyEmailAlerts = 0) {
  const u = await createTestUser(t);
  await t.client`
    insert into entitlements (user_id, plan_id, source, max_monitors, max_web_topics, page_interval_minutes, cloud_relay, email_alerts,
      history_days, advanced_history, data_exports, monthly_search_calls, monthly_email_alerts, business_sites, business_endpoints_per_site,
      business_http_interval_seconds, business_scenarios_per_site, business_scenario_interval_minutes, business_tls_checks, priority_alerts)
    values (${u.id}, 'business', 'subscription', 200, 10, 15, true, true, 365, true, true, 600, ${monthlyEmailAlerts}, 3, 10, 60, 2, 30, true, true)`;
  const site = async (domain: string) =>
    (await t.client<{ id: string }[]>`insert into business_sites (user_id, name, domain, verification_token) values (${u.id}, ${domain}, ${domain}, 'tok') returning id`)[0]!.id;
  return { u, site };
}

const down = (userId: string, siteId: string, key: string) =>
  notify(t.db, { userId, type: "business_down", priority: "critical", title: "Indisponible", body: "502", siteId, dedupKey: key });
const up = (userId: string, siteId: string, key: string) =>
  notify(t.db, { userId, type: "business_recovered", title: "Rétabli", body: "200", siteId, dedupKey: key });

describe("alertes Business : anti-répétition, regroupement, plafond technique", () => {
  it("hors quota de la formule, mais un seul e-mail par site et par type sur 10 minutes (regroupement)", async () => {
    const { u, site } = await businessUser(0);
    const s = await site("a.example.test");
    const first = await down(u.id, s, "inc:a1");
    const second = await down(u.id, s, "inc:a2"); // autre point de contrôle du même site, même moment
    expect(first?.email).toBe("pending");
    expect(second).toMatchObject({ email: "skipped", emailSuppressed: "grouped" });
    // Un autre site n'est pas regroupé avec le premier.
    expect((await down(u.id, await site("b.example.test"), "inc:b1"))?.email).toBe("pending");
    // Le rétablissement (autre type) part normalement.
    expect((await up(u.id, s, "inc:a1:ok"))?.email).toBe("pending");
    // Toutes les alertes restent visibles dans l'application.
    const inApp = await t.client`select 1 from notifications where user_id = ${u.id} and type in ('business_down', 'business_recovered')`;
    expect(inApp).toHaveLength(4);
  });

  it("site instable : au-delà de 4 pannes par heure, une synthèse unique puis plus d'e-mail", async () => {
    const { u, site } = await businessUser(0);
    const s = await site("flap.example.test");
    // 4 pannes déjà envoyées par e-mail dans l'heure (au-delà de la fenêtre de regroupement).
    for (let i = 0; i < 4; i++) {
      await t.client`insert into notifications (user_id, type, priority, title, body, site_id, email_status, desktop_status, dedup_key, created_at)
                     values (${u.id}, 'business_down', 'critical', 'x', 'y', ${s}, 'sent', 'none', ${"old:" + i}, now() - make_interval(mins => ${15 + i * 10}))`;
    }
    const r = await down(u.id, s, "inc:flap5");
    expect(r).toMatchObject({ email: "skipped", emailSuppressed: "flapping" });
    const r2 = await down(u.id, s, "inc:flap6");
    expect(r2?.emailSuppressed).toBe("flapping");
    const synth = await t.client<{ email_status: string }[]>`select email_status from notifications where user_id = ${u.id} and title like 'Site instable%'`;
    expect(synth).toEqual([{ email_status: "pending" }]);
    const outbox = await t.client`select 1 from email_outbox where user_id = ${u.id}`;
    expect(outbox).toHaveLength(1);
  });

  it("plafond technique quotidien par compte (anti-abus)", async () => {
    const { u, site } = await businessUser(0);
    await t.client`insert into app_settings (key, value) values ('limit.business_alert_emails_per_day', '3'::jsonb)
                   on conflict (key) do update set value = excluded.value`;
    try {
      const results = [];
      for (let i = 0; i < 4; i++) results.push(await down(u.id, await site(`cap${i}.example.test`), `inc:cap${i}`));
      expect(results.map((r) => r?.email)).toEqual(["pending", "pending", "pending", "skipped"]);
      expect(results[3]?.emailSuppressed).toBe("daily_cap");
      const notice = await t.client`select 1 from notifications where user_id = ${u.id} and title like 'Limite technique%'`;
      expect(notice).toHaveLength(1);
    } finally {
      await t.client`update app_settings set value = '60'::jsonb where key = 'limit.business_alert_emails_per_day'`;
    }
  });
});
