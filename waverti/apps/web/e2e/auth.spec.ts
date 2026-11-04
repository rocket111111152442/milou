import { expect, test } from "@playwright/test";
import { login, PASSWORD, resetRateLimits, signUpAndConfirm, uniqueEmail, waitForEmailLink } from "./helpers";

test.describe("authentification (comptes Waverti réels)", () => {
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
    await expect(page).toHaveURL(/\/app\/(surveillances|abonnement)/);
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
    // URL finale (le compte n'a pas de formule : /app redirige vers l'abonnement) : évite de naviguer pendant une redirection en cours.
    await expect(page).toHaveURL(/\/app\/abonnement/);
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

test.describe("liens reçus par e-mail", () => {
  test("lien de confirmation inconnu, expiré ou déjà utilisé : page explicative, aucune session ouverte", async ({ page }) => {
    await page.goto(`/auth/confirm?token=${"a".repeat(43)}`);
    await expect(page).toHaveURL(/\/lien-confirmation-invalide$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Ce lien de confirmation n'est plus valable");
    await expect(page.getByText(/confirmer votre adresse e-mail/)).toBeVisible();
    await expect(page.getByRole("link", { name: "Aller à la connexion" })).toHaveAttribute("href", "/connexion");
    await expect(page.getByRole("link", { name: "Mot de passe oublié" })).toHaveAttribute("href", "/mot-de-passe-oublie");
    await expect(page.getByRole("button", { name: "Recevoir un nouveau lien de confirmation" })).toBeVisible();
    // Aucune session créée par un lien invalide : l'espace reste protégé.
    await page.goto("/app");
    await expect(page).toHaveURL(/\/connexion/);
  });

  test("renvoi du lien de confirmation : réponse neutre pour une adresse inconnue", async ({ page }) => {
    await page.goto("/lien-confirmation-invalide");
    await page.getByLabel("Adresse e-mail à confirmer").fill("personne-inconnue@example.test");
    await page.getByRole("button", { name: "Recevoir un nouveau lien de confirmation" }).click();
    await expect(page.getByText(/Si l'adresse doit encore être vérifiée/)).toBeVisible();
  });

  test("mot de passe oublié : réponse conditionnelle, durée du lien et lien le plus récent expliqués", async ({ page }) => {
    await page.goto("/mot-de-passe-oublie");
    await expect(page.getByText(/valable 1 heure/).first()).toBeVisible();
    await page.getByLabel("Adresse e-mail").fill("personne@example.test");
    await page.getByRole("button", { name: /Recevoir un lien/ }).click();
    const msg = page.getByText(/Si un compte existe pour cette adresse/);
    await expect(msg).toBeVisible();
    await expect(msg).toContainText("peut vous être envoyé");
    await expect(msg).toContainText("le plus récent");
    await expect(msg).not.toContainText("vient d'être envoyé");
  });
});
