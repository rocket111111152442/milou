import { expect, test } from "@playwright/test";
import { createConfirmedUser, login, resetRateLimits, sql, uniqueEmail } from "./helpers";

test.describe("Business (moteur C)", () => {
  test.beforeEach(resetRateLimits);

  test("formule sans Business : présentation honnête, aucune création possible", async ({ page }) => {
    const u = await createConfirmedUser(uniqueEmail("free"));
    await login(page, u.email);
    await page.waitForURL(/\/app/);
    await page.goto("/app/business");
    await expect(page.getByRole("heading", { name: "Fonction incluse dans la formule Business" })).toBeVisible();
    const res = await page.request.post("/api/business/sites", { data: { name: "X", domain: "x-site.fr" }, headers: { origin: "http://localhost:3000" } });
    expect(res.status()).toBe(403);
    expect((await res.json()).error).toBe("business_not_included");
  });

  test("site : vérification de propriété, points de contrôle, scénario, rapport", async ({ page }) => {
    const u = await createConfirmedUser(uniqueEmail("biz"), { plan: "business" });
    const domain = `boutique-${Date.now().toString(36)}.test`;
    await login(page, u.email, undefined, "/app/business");
    await page.waitForURL(/\/app\/business/);
    await page.getByRole("link", { name: "Ajouter un site" }).click();
    await page.getByLabel(/^Nom du site/).fill("Ma boutique");
    await page.getByLabel(/^Domaine/).fill(`https://www.${domain}/accueil`);
    await page.getByRole("button", { name: "Continuer vers la vérification" }).click();

    // Vérification : instructions DNS réelles, échec honnête tant que l'enregistrement n'existe pas.
    await expect(page.getByRole("heading", { name: `Prouvez que vous êtes propriétaire de ${domain}` })).toBeVisible();
    await expect(page.getByText(`_watchly.${domain}`)).toBeVisible();
    await expect(page.getByText(/^watchly-verification=/)).toBeVisible();
    await page.getByRole("button", { name: "Vérifier l'enregistrement DNS" }).click();
    await expect(page.getByText("Vérification non concluante")).toBeVisible();

    // Le DNS de test n'étant pas publiable, la preuve est simulée en base pour la suite du parcours.
    await sql`update business_sites set status = 'verified', verification_method = 'dns', verified_at = now() where domain = ${domain}`;
    await page.reload();
    await expect(page.getByRole("heading", { name: "Points de contrôle (0/3)" })).toBeVisible();

    await page.getByRole("textbox", { name: "Nom", exact: true }).fill("Accueil");
    await page.getByRole("textbox", { name: "Adresse", exact: true }).fill(`https://${domain}/`);
    await page.getByRole("textbox", { name: "Texte attendu (facultatif)" }).fill("Bienvenue");
    await page.getByRole("button", { name: "Ajouter", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Points de contrôle (1/3)" })).toBeVisible();
    await expect(page.getByText("En attente du premier contrôle")).toBeVisible();

    // Adresse hors du domaine vérifié : refusée côté serveur.
    await page.getByRole("textbox", { name: "Nom", exact: true }).fill("Tiers");
    await page.getByRole("textbox", { name: "Adresse", exact: true }).fill("https://autre-site.example.com/");
    await page.getByRole("button", { name: "Ajouter", exact: true }).click();
    await expect(page.getByText(`L'adresse doit appartenir au domaine vérifié ${domain}.`)).toBeVisible();

    // Scénario avec une étape de paiement : refusé.
    await page.getByRole("textbox", { name: "Nom du scénario" }).fill("Achat");
    await page.getByLabel("Action").first().selectOption("click");
    await page.getByLabel("Sélecteur CSS ou text=…").fill("text=Payer maintenant");
    await page.getByRole("button", { name: "Créer le scénario" }).click();
    await expect(page.getByText(/Étape 1 refusée : action potentiellement engageante/)).toBeVisible();

    await page.getByRole("textbox", { name: "Nom du scénario" }).fill("Recherche produit");
    await page.getByLabel("Action").first().selectOption("expect_text");
    await page.getByLabel("Texte attendu").last().fill("Bienvenue");
    await page.getByRole("button", { name: "Créer le scénario" }).click();
    await expect(page.getByRole("heading", { name: "Scénario de parcours (1/1)" })).toBeVisible();
    await expect(page.getByText("Jamais exécuté")).toBeVisible();

    // Disponibilité : aucune donnée inventée avant les premiers contrôles.
    await expect(page.getByText("Pas encore de mesure")).toBeVisible();

    await page.getByRole("link", { name: "Rapport mensuel" }).click();
    await expect(page.getByRole("heading", { name: /Rapport de disponibilité/ })).toBeVisible();
    await expect(page.getByText("Aucune mesure sur la période.")).toBeVisible();
    const csv = await page.request.get(page.url().replace(/\/app\/business\/sites\/([^/]+)\/rapport$/, "/api/business/sites/$1/report?jours=30"));
    expect(csv.status()).toBe(200);
    expect(csv.headers()["content-type"]).toContain("text/csv");
    expect(await csv.text()).toContain("jour;point_de_controle;adresse");
  });

  test("isolation : un client ne voit ni ne modifie le site d'un autre", async ({ browser }) => {
    const a = await createConfirmedUser(uniqueEmail("a"), { plan: "business" });
    const b = await createConfirmedUser(uniqueEmail("b"), { plan: "business" });
    const domain = `prive-${Date.now().toString(36)}.test`;
    const [site] = await sql<{ id: string }[]>`
      insert into business_sites (user_id, name, domain, status, verification_token) values (${a.id}, 'Site A', ${domain}, 'verified', 'watchly-verification=x') returning id`;
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await login(page, b.email);
    await page.waitForURL(/\/app/);
    // Page privée rendue en streaming (statut 200) : on vérifie l'écran « introuvable » et l'absence de toute donnée.
    await page.goto(`/app/business/sites/${site!.id}`);
    await expect(page.getByRole("heading", { name: "Cette page est introuvable" })).toBeVisible();
    expect(await page.content()).not.toContain(domain);
    expect(await page.content()).not.toContain("watchly-verification=x");
    const headers = { origin: "http://localhost:3000" };
    expect((await page.request.post(`/api/business/sites/${site!.id}/endpoints`, { data: { name: "x", url: `https://${domain}/` }, headers })).status()).toBe(404);
    expect((await page.request.delete(`/api/business/sites/${site!.id}`, { headers })).status()).toBe(404);
    expect(await (await page.request.get(`/api/business/sites/${site!.id}/report`)).text()).not.toContain(domain);
    const [still] = await sql<{ n: number }[]>`select count(*)::int as n from business_sites where id = ${site!.id}`;
    expect(still!.n).toBe(1);
    await ctx.close();
  });
});
