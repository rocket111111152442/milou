/**
 * Page Abonnement : offres affichées selon l'état réel du compte, retour Checkout vérifié côté serveur,
 * changement de formule dans les paramètres. Stripe simulé (stripe-mock) : aucun paiement, aucune carte.
 * Définir SHOTS_DIR pour enregistrer des captures d'écran de contrôle visuel.
 */
import { expect, test, type Page } from "@playwright/test";
import { createConfirmedUser, login, resetRateLimits, sql, uniqueEmail } from "./helpers";

async function shot(page: Page, name: string) {
  const dir = process.env.SHOTS_DIR;
  if (dir) await page.screenshot({ path: `${dir}/${name}.png`, fullPage: true });
}

test.describe("page Abonnement", () => {
  test.beforeEach(resetRateLimits);

  test("sans abonnement et éligible : offres « Essayer 3 jours »", async ({ page }) => {
    const u = await createConfirmedUser(uniqueEmail("elig"), { plan: null });
    await login(page, u.email, undefined, "/app/abonnement");
    await page.waitForURL(/\/app\/abonnement$/);
    await expect(page.getByRole("heading", { name: "Choisir une formule — 3 jours d'essai gratuit" })).toBeVisible();
    await page.goto("/app/abonnement?bienvenue=1");
    await expect(page.getByText(/gratuitement pendant 3 jours/)).toBeVisible();
    for (const n of ["Plus", "Pro", "Max", "Business"]) await expect(page.getByRole("link", { name: `Essayer ${n} 3 jours` })).toBeVisible();
    await shot(page, "abonnement-eligible");
  });

  test("essai déjà utilisé : « Souscrire à … », aucune promesse d'essai", async ({ page }) => {
    const u = await createConfirmedUser(uniqueEmail("used"), { plan: null });
    await sql`insert into trial_usage (user_id, email_hash, plan_id, status) values (${u.id}, ${"h_" + u.id}, 'plus', 'canceled')`;
    await login(page, u.email, undefined, "/app/abonnement");
    await page.waitForURL(/\/app\/abonnement$/);
    await expect(page.getByRole("heading", { name: "Choisir une formule", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Souscrire à Plus" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Essayer .* 3 jours/ })).toHaveCount(0);
    await expect(page.getByText(/essai gratuit a déjà été utilisé/).first()).toBeVisible();
    // Le bandeau d'accueil ne promet pas un essai gratuit à un compte qui l'a déjà utilisé.
    await page.goto("/app/abonnement?bienvenue=1");
    await expect(page.getByText("Bienvenue sur Waverti")).toBeVisible();
    await expect(page.getByText(/gratuitement pendant 3 jours/)).toHaveCount(0);
    await expect(page.getByText(/Votre essai gratuit a déjà été utilisé/).first()).toBeVisible();
    await shot(page, "abonnement-non-eligible");
  });

  test("abonné (essai ou achat) : plus d'offres en bas, changement de formule dans Paramètres", async ({ page }) => {
    const u = await createConfirmedUser(uniqueEmail("sub"), { plan: "plus", status: "trialing" });
    await login(page, u.email, undefined, "/app/abonnement");
    await page.waitForURL(/\/app\/abonnement$/);
    await expect(page.getByRole("heading", { name: "Formule Plus" })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Choisir une formule|Changer de formule/ })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /Essayer .* 3 jours|Souscrire à/ })).toHaveCount(0);
    await shot(page, "abonnement-abonne");
    await page.getByRole("link", { name: "Paramètres → Formule" }).click();
    await expect(page).toHaveURL(/\/app\/parametres#formule$/);
    const card = page.locator("#formule");
    await expect(card.getByRole("heading", { name: "Formule" })).toBeVisible();
    await expect(card.getByText("Formule actuelle").first()).toBeVisible();
    for (const n of ["Pro", "Max", "Business"]) await expect(card.getByRole("button", { name: `Passer à ${n}` })).toBeVisible();
    await shot(page, "parametres-formule");
  });

  test("retour Checkout : sans session, session inconnue ou falsifiée → jamais de message de succès", async ({ page }) => {
    const u = await createConfirmedUser(uniqueEmail("ret"), { plan: null });
    await login(page, u.email, undefined, "/app/abonnement");
    await page.waitForURL(/\/app\/abonnement$/);
    for (const q of ["checkout=success", "checkout=success&session_id=cs_test_inconnue0000000", "checkout=success&session_id=n'importe-quoi"]) {
      await page.goto(`/app/abonnement?${q}`);
      await expect(page.getByText("Retour de paiement non vérifié")).toBeVisible();
      await expect(page.getByText(/Paiement enregistré|Essai démarré|Abonnement confirmé/)).toHaveCount(0);
      await expect(page.getByText("Aucun abonnement en cours")).toBeVisible();
    }
    await shot(page, "abonnement-retour-non-verifie");
  });

  test("double abonnement : l'API de paiement refuse un compte déjà abonné", async ({ page }) => {
    const u = await createConfirmedUser(uniqueEmail("dbl"), { plan: "plus" });
    await login(page, u.email, undefined, "/app/abonnement");
    await page.waitForURL(/\/app\/abonnement$/);
    const r = await page.request.post("/api/billing/checkout", { data: { planId: "pro", acknowledged: true }, headers: { origin: "http://localhost:3000" } });
    expect(r.status()).toBeGreaterThanOrEqual(400);
    expect(r.status()).toBeLessThan(500);
  });
});
