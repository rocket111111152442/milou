import { expect, test } from "@playwright/test";
import { createConfirmedUser, login, resetRateLimits, sql, uniqueEmail } from "./helpers";

const ORIGIN = { origin: "http://localhost:3000" };

test.describe("surveillances (moteurs A et B)", () => {
  test.beforeEach(resetRateLimits);

  test("création par le formulaire, pause, reprise et suppression", async ({ page }) => {
    const u = await createConfirmedUser(uniqueEmail("mon"));
    await login(page, u.email, undefined, "/app/surveillances/nouvelle");
    await page.waitForURL(/surveillances\/nouvelle/);
    // Formule Découverte : la recherche sur Internet est réservée aux formules payantes.
    await expect(page.getByRole("radio", { name: /Un sujet sur Internet/ })).toBeDisabled();
    await page.getByLabel(/^Adresse de la page/).fill("https://boutique.example.com/casque");
    await page.getByLabel(/^Seuil de prix/).fill("99");
    await page.getByLabel(/^Nom de la surveillance/).fill("Casque <script>alert(1)</script>");
    await page.getByRole("button", { name: "Créer la surveillance" }).click();
    await page.waitForURL(/\/app\/surveillances\/[0-9a-f-]{36}$/);
    // Le nom est affiché comme du texte (aucune injection HTML).
    await expect(page.getByRole("heading", { name: "Casque <script>alert(1)</script>" })).toBeVisible();
    await expect(page.getByText("Prix sous 99,00 €")).toBeVisible();

    const id = page.url().split("/").pop()!;
    const [task] = await sql<{ status: string; execution_mode: string }[]>`select status, execution_mode from monitoring_tasks where id = ${id}`;
    // Sans relais cloud (Découverte), les contrôles se font uniquement sur l'ordinateur relié.
    expect(task).toEqual({ status: "active", execution_mode: "local_only" });

    await page.getByRole("button", { name: "Autres actions" }).click();
    await page.getByRole("menuitem", { name: "Mettre en pause" }).click();
    await expect(page.getByText("Surveillance en pause").first()).toBeVisible();
    await page.getByRole("button", { name: "Autres actions" }).click();
    await page.getByRole("menuitem", { name: "Reprendre" }).click();
    await expect(page.getByText("Surveillance reprise").first()).toBeVisible();

    // Export réservé aux formules qui l'incluent.
    expect((await page.request.get(`/api/monitors/${id}/export`)).status()).toBe(403);

    const del = await page.request.delete(`/api/monitors/${id}`, { headers: ORIGIN });
    expect(del.status()).toBe(200);
    expect(await sql`select 1 from monitoring_tasks where id = ${id}`).toHaveLength(0);
  });

  test("quotas appliqués par le serveur (formule Découverte : 3 surveillances)", async ({ page }) => {
    const u = await createConfirmedUser(uniqueEmail("quota"));
    await login(page, u.email);
    await page.waitForURL(/\/app/);
    const body = (n: number) => ({
      kind: "page",
      name: `Produit ${n}`,
      url: `https://shop${n}.example.com/p`,
      condition: { type: "page_changed", sensitivity: "significant" },
      notify: { inapp: true, email: false, desktop: true },
    });
    for (let i = 1; i <= 3; i++) expect((await page.request.post("/api/monitors", { data: body(i), headers: ORIGIN })).status()).toBe(201);
    const fourth = await page.request.post("/api/monitors", { data: body(4), headers: ORIGIN });
    expect(fourth.status()).toBe(403);
    expect((await fourth.json()).error).toBe("monitor_limit");
    // Fréquence plus rapide que la formule : refusée.
    const fast = await page.request.post("/api/monitors", { data: { ...body(5), intervalMinutes: 5 }, headers: ORIGIN });
    expect(fast.status()).toBeGreaterThanOrEqual(400);
    // Recherche sur Internet : non incluse.
    const topic = await page.request.post("/api/monitors", {
      data: { kind: "web_topic", name: "Sortie", request: "Préviens-moi de la date de sortie officielle de Projet Aurora", notify: { inapp: true, email: false, desktop: true } },
      headers: ORIGIN,
    });
    expect(topic.status()).toBe(403);
  });

  test("adresses internes refusées à la création (protection SSRF)", async ({ page }) => {
    const u = await createConfirmedUser(uniqueEmail("ssrf"), { plan: "pro" });
    await login(page, u.email);
    await page.waitForURL(/\/app/);
    for (const url of ["http://127.0.0.1/admin", "http://169.254.169.254/latest/meta-data", "http://10.0.0.1/", "file:///etc/passwd", "http://localhost:3000/api/health", "http://intranet/"]) {
      const r = await page.request.post("/api/monitors", {
        data: { kind: "page", name: "x", url, condition: { type: "page_changed", sensitivity: "any" }, notify: { inapp: true, email: false, desktop: false } },
        headers: ORIGIN,
      });
      expect(r.status(), url).toBeGreaterThanOrEqual(400);
      expect(r.status(), url).toBeLessThan(500);
    }
    const preview = await page.request.post("/api/monitors/preview", { data: { url: "http://169.254.169.254/latest/meta-data" }, headers: ORIGIN });
    const pj = await preview.json();
    expect(pj.ok ?? false).toBe(false);
  });
});
