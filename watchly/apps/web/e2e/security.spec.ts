import { expect, test } from "@playwright/test";
import { createConfirmedUser, login, resetRateLimits, sql, uniqueEmail } from "./helpers";

const ORIGIN = { origin: "http://localhost:3000" };
const monitor = { kind: "page", name: "Privé", url: "https://prive.example.com/p", condition: { type: "page_changed", sensitivity: "any" }, notify: { inapp: true, email: false, desktop: false } };

test.describe("sécurité", () => {
  test.beforeEach(resetRateLimits);

  test("API privées : 401 sans session", async ({ request }) => {
    for (const path of ["/api/monitors", "/api/notifications", "/api/devices", "/api/account/export", "/api/overview", "/api/business/sites"]) {
      expect((await request.get(path)).status(), path).toBe(401);
    }
    expect((await request.post("/api/monitors", { data: monitor, headers: ORIGIN })).status()).toBe(401);
    expect((await request.post("/api/billing/checkout", { data: { planId: "plus" }, headers: ORIGIN })).status()).toBe(401);
  });

  test("cookies de session inaccessibles au JavaScript (httpOnly, SameSite=Lax)", async ({ page, context }) => {
    const u = await createConfirmedUser(uniqueEmail("cookie"));
    await login(page, u.email);
    await page.waitForURL(/\/app/);
    const session = (await context.cookies()).filter((c) => c.name.startsWith("sb-") && c.name.includes("auth-token"));
    expect(session.length).toBeGreaterThan(0);
    for (const c of session) expect(c).toMatchObject({ httpOnly: true, sameSite: "Lax" });
    expect(await page.evaluate(() => document.cookie)).not.toContain("auth-token");
  });

  test("protection CSRF : écriture refusée depuis une autre origine", async ({ page }) => {
    const u = await createConfirmedUser(uniqueEmail("csrf"));
    await login(page, u.email);
    await page.waitForURL(/\/app/);
    const evil = await page.request.post("/api/monitors", { data: monitor, headers: { origin: "https://site-malveillant.example" } });
    expect(evil.status()).toBe(403);
    const deletion = await page.request.post("/api/account/delete", { data: { confirm: true }, headers: { origin: "https://site-malveillant.example" } });
    expect(deletion.status()).toBe(403);
    const [stillThere] = await sql<{ n: number }[]>`select count(*)::int as n from profiles where id = ${u.id}`;
    expect(stillThere!.n).toBe(1);
    const [p] = await sql<{ n: number }[]>`select count(*)::int as n from monitoring_tasks where user_id = ${u.id}`;
    expect(p!.n).toBe(0);
  });

  test("isolation entre comptes : aucune lecture ni modification croisée", async ({ browser }) => {
    const a = await createConfirmedUser(uniqueEmail("a"));
    const b = await createConfirmedUser(uniqueEmail("b"));
    const ca = await browser.newContext();
    const pa = await ca.newPage();
    await login(pa, a.email);
    await pa.waitForURL(/\/app/);
    const created = await pa.request.post("/api/monitors", { data: monitor, headers: ORIGIN });
    const { id } = await created.json();
    await ca.close();

    const cb = await browser.newContext();
    const pb = await cb.newPage();
    await login(pb, b.email);
    await pb.waitForURL(/\/app/);
    expect((await pb.request.get(`/api/monitors/${id}`)).status()).toBe(404);
    expect((await pb.request.patch(`/api/monitors/${id}`, { data: { name: "piraté" }, headers: ORIGIN })).status()).toBe(404);
    expect((await pb.request.post(`/api/monitors/${id}/pause`, { headers: ORIGIN })).status()).toBe(404);
    expect((await pb.request.delete(`/api/monitors/${id}`, { headers: ORIGIN })).status()).toBe(404);
    const list = await (await pb.request.get("/api/monitors")).json();
    expect(list.monitors).toHaveLength(0);
    const exported = await (await pb.request.get("/api/account/export")).text();
    expect(exported).not.toContain(id);
    await pb.goto(`/app/surveillances/${id}`);
    await expect(pb.getByRole("heading", { name: "Cette page est introuvable" })).toBeVisible();
    await cb.close();
    const [row] = await sql<{ name: string; status: string }[]>`select name, status from monitoring_tasks where id = ${id}`;
    expect(row).toEqual({ name: "Privé", status: "active" });
  });

  test("jeton d'appareil : invalide refusé, limité aux routes autorisées", async ({ request }) => {
    const bad = { authorization: "Bearer wly_dev_inexistant_0000000000000000000000" };
    expect((await request.post("/api/agent/heartbeat", { data: { state: "idle", runningJobs: 0 }, headers: bad })).status()).toBe(401);
    expect((await request.post("/api/agent/jobs/claim", { data: { max: 1 }, headers: bad })).status()).toBe(401);
    expect((await request.get("/api/monitors", { headers: bad })).status()).toBe(401);
    // Un jeton (même valide) n'ouvre jamais l'administration.
    expect((await request.post("/api/admin/users/00000000-0000-4000-8000-000000000000/suspension", { data: { suspended: true, reason: "xxxxxx" }, headers: { ...bad, ...ORIGIN } })).status()).toBe(404);
    expect((await request.get("/api/admin/users/00000000-0000-4000-8000-000000000000/suspension")).status()).toBe(404);
  });

  test("webhook Stripe : signature obligatoire", async ({ request }) => {
    const r = await request.post("/api/stripe/webhook", { data: JSON.stringify({ id: "evt_x", type: "customer.subscription.created" }), headers: { "content-type": "application/json" } });
    expect(r.status()).toBe(400);
    const forged = await request.post("/api/stripe/webhook", {
      data: JSON.stringify({ id: "evt_x", type: "customer.subscription.created" }),
      headers: { "content-type": "application/json", "stripe-signature": "t=1,v1=deadbeef" },
    });
    expect(forged.status()).toBe(400);
  });

  test("limitation des tentatives de connexion", async ({ page }) => {
    const u = await createConfirmedUser(uniqueEmail("brute"));
    let limited = false;
    for (let i = 0; i < 12 && !limited; i++) {
      await page.goto("/connexion");
      await page.getByLabel("Adresse e-mail").fill(u.email);
      await page.getByLabel(/^Mot de passe/).fill(`mauvais-${i}-motdepasse`);
      await page.getByRole("button", { name: "Se connecter" }).click();
      const alert = page.getByRole("alert").filter({ hasText: /.+/ }).first();
      await alert.waitFor();
      limited = /Trop de tentatives/.test(await alert.innerText());
    }
    expect(limited).toBe(true);
  });
});
