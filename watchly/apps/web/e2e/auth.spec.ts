import { expect, test } from "@playwright/test";
import { login, PASSWORD, resetRateLimits, signUpAndConfirm, uniqueEmail, waitForEmailLink } from "./helpers";

test.describe("authentification (Supabase réel)", () => {
  test.beforeEach(resetRateLimits);

  test("inscription, vérification de l'e-mail puis onboarding", async ({ page }) => {
    await signUpAndConfirm(page);
    // Aucune formule gratuite : sans formule choisie, l'accueil mène au choix d'un abonnement.
    await expect(page).toHaveURL(/\/app\/abonnement\?bienvenue=1/);
    await expect(page.getByText(/Choisissez la formule qui vous convient/)).toBeVisible();
    await expect(page.getByRole("link", { name: "Essayer Max 3 jours" })).toBeVisible();
  });

  test("validations d'inscription côté serveur", async ({ page }) => {
    await page.goto("/inscription");
    await page.getByLabel("Adresse e-mail").fill(uniqueEmail());
    await page.getByLabel(/^Mot de passe/).fill("court");
    // Contourne la validation HTML pour vérifier la validation serveur
    await page.evaluate(() => document.querySelector("form")?.setAttribute("novalidate", ""));
    await page.getByRole("button", { name: "Créer mon compte" }).click();
    await expect(page.getByText("10 caractères minimum").first()).toBeVisible();
    await expect(page.getByText("Vous devez accepter les conditions")).toBeVisible();
  });

  test("connexion : message générique en cas d'erreur, redirection vers la page demandée", async ({ page }) => {
    const email = await signUpAndConfirm(page);
    await page.context().clearCookies();
    await page.goto("/app/surveillances");
    await expect(page).toHaveURL(/\/connexion\?suivant=%2Fapp%2Fsurveillances/);
    await login(page, email, "MauvaisMotDePasse1");
    await expect(page.getByText("Adresse e-mail ou mot de passe incorrect.")).toBeVisible();
    await login(page, "inconnu@example.test", "MauvaisMotDePasse1");
    await expect(page.getByText("Adresse e-mail ou mot de passe incorrect.")).toBeVisible();
    await login(page, email, PASSWORD, "/app/surveillances");
    await expect(page).toHaveURL(/\/app\/(surveillances|bienvenue)/);
  });

  test("mot de passe oublié puis réinitialisation", async ({ page }) => {
    const email = await signUpAndConfirm(page);
    await page.context().clearCookies();
    await page.goto("/mot-de-passe-oublie");
    await page.getByLabel("Adresse e-mail").fill(email);
    await page.getByRole("button", { name: /Recevoir un lien/ }).click();
    await expect(page.getByText(/Si un compte existe pour cette adresse/)).toBeVisible();
    const link = await waitForEmailLink(email, "Réinitialisation");
    await page.goto(link);
    await expect(page).toHaveURL(/reinitialiser-mot-de-passe/);
    const next = "NouveauMotDePasse-2027";
    await page.getByLabel("Nouveau mot de passe").fill(next);
    await page.getByLabel("Confirmez le mot de passe").fill(next);
    await page.getByRole("button", { name: "Enregistrer le mot de passe" }).click();
    await expect(page).toHaveURL(/\/app/);
    await page.context().clearCookies();
    await login(page, email, next);
    await expect(page).toHaveURL(/\/app/);
  });

  test("la même réponse est donnée pour une adresse inconnue (pas d'énumération)", async ({ page }) => {
    await page.goto("/mot-de-passe-oublie");
    await page.getByLabel("Adresse e-mail").fill("personne@example.test");
    await page.getByRole("button", { name: /Recevoir un lien/ }).click();
    await expect(page.getByText(/Si un compte existe pour cette adresse/)).toBeVisible();
  });

  test("déconnexion", async ({ page }) => {
    await signUpAndConfirm(page);
    await page.getByRole("button", { name: "Passer l'introduction" }).click();
    await page.getByRole("button", { name: "Menu du compte" }).click();
    await page.getByRole("menuitem", { name: "Déconnexion" }).click();
    await expect(page).toHaveURL("/");
    await page.goto("/app");
    await expect(page).toHaveURL(/\/connexion/);
  });

  test("l'administration est invisible pour un utilisateur standard", async ({ page, request }) => {
    const anonymous = await request.get("/admin", { maxRedirects: 0 });
    expect(anonymous.status()).toBe(404);
    await signUpAndConfirm(page);
    const res = await page.goto("/admin");
    expect(res?.status()).toBe(404);
  });
});
