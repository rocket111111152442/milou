import { expect, test } from "@playwright/test";
import { createConfirmedUser, login, resetRateLimits, sql, uniqueEmail } from "./helpers";

const ORIGIN = { origin: "http://localhost:3000" };

test.describe("surveillances (moteurs A et B)", () => {
  test.beforeEach(resetRateLimits);

  test("création par le formulaire, pause, reprise et suppression", async ({ page }) => {
    const u = await createConfirmedUser(uniqueEmail("mon"), { plan: "plus" });
    await login(page, u.email, undefined, "/app/surveillances/nouvelle");
    await page.waitForURL(/surveillances\/nouvelle/);
    // Étape 1 : catégorie ; étape 2 : objectif, adresse et seuil ; étape 3 : résumé.
    await page.getByRole("listitem").filter({ hasText: "Prix" }).first().click();
    await expect(page.getByRole("radio", { name: /Prix inférieur à une valeur/ })).toHaveAttribute("aria-checked", "true");
    await page.getByLabel(/^Adresse/).fill("https://boutique.example.com/casque");
    await page.getByLabel("Montant en euros").fill("99");
    await page.getByRole("button", { name: /Continuer/ }).click();
    await expect(page.getByRole("heading", { name: "Résumé avant création" })).toBeVisible();
    await expect(page.getByText("Le prix est inférieur à 99 €")).toBeVisible();
    await page.getByLabel(/^Nom de la surveillance/).fill("Casque <script>alert(1)</script>");
    await page.getByRole("button", { name: "Créer la surveillance" }).click();
    await page.waitForURL(/\/app\/surveillances\/[0-9a-f-]{36}$/);
    // Le nom est affiché comme du texte (aucune injection HTML).
    await expect(page.getByRole("heading", { name: "Casque <script>alert(1)</script>" })).toBeVisible();
    await expect(page.getByText("Le prix est inférieur à 99 €").first()).toBeVisible();

    const id = page.url().split("/").pop()!;
    const [task] = await sql<{ status: string; execution_mode: string; type: string }[]>`select status, execution_mode, condition->>'type' as type from monitoring_tasks where id = ${id}`;
    // Les règles sont contrôlées par les serveurs Waverti.
    expect(task).toEqual({ status: "active", execution_mode: "cloud_only", type: "rule" });

    await page.getByRole("button", { name: "Autres actions" }).click();
    await page.getByRole("menuitem", { name: "Mettre en pause" }).click();
    await expect(page.getByText("Surveillance en pause").first()).toBeVisible();
    await page.getByRole("button", { name: "Autres actions" }).click();
    await page.getByRole("menuitem", { name: "Reprendre" }).click();
    await expect(page.getByText("Surveillance reprise").first()).toBeVisible();

    // Export réservé aux formules qui l'incluent (Pro, Max, Business).
    expect((await page.request.get(`/api/monitors/${id}/export`)).status()).toBe(403);

    const del = await page.request.delete(`/api/monitors/${id}`, { headers: ORIGIN });
    expect(del.status()).toBe(200);
    expect(await sql`select 1 from monitoring_tasks where id = ${id}`).toHaveLength(0);
  });

  test("sans abonnement : aucune surveillance possible (pas de formule gratuite)", async ({ page }) => {
    const u = await createConfirmedUser(uniqueEmail("noplan"), { plan: null });
    await login(page, u.email);
    await page.waitForURL(/\/app/);
    // Sans formule, l'accueil mène au choix d'un abonnement avec essai de 3 jours.
    await page.goto("/app/bienvenue");
    await expect(page).toHaveURL(/\/app\/abonnement\?bienvenue=1/);
    for (const name of ["Plus", "Pro", "Max", "Business"]) {
      await expect(page.getByRole("link", { name: `Essayer ${name} 3 jours` })).toBeVisible();
    }
    const r = await page.request.post("/api/monitors", {
      data: { kind: "page", name: "x", url: "https://shop.example.com/p", condition: { type: "page_changed", sensitivity: "any" }, notify: { inapp: true, email: false, desktop: true } },
      headers: ORIGIN,
    });
    expect(r.status()).toBe(403);
    expect((await r.json()).error).toBe("subscription_required");
  });

  test("quotas appliqués par le serveur (essai : 3 surveillances, 1 sujet)", async ({ page }) => {
    const u = await createConfirmedUser(uniqueEmail("quota"), { plan: "pro", status: "trialing" });
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
    // Essai : le quota de 3 surveillances inclut les sujets de recherche.
    const topic = await page.request.post("/api/monitors", {
      data: { kind: "web_topic", name: "Sortie", request: "Préviens-moi de la date de sortie officielle de Projet Aurora", notify: { inapp: true, email: false, desktop: true } },
      headers: ORIGIN,
    });
    expect(topic.status()).toBe(403);
    expect((await topic.json()).error).toBe("monitor_limit");
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
