/**
 * Abonnements en MODE TEST Stripe, contre stripe-mock (aucun paiement réel, aucune carte saisie
 * sur Watchly). La logique des webhooks est couverte par les tests d'intégration ; ici on vérifie
 * le parcours visible et le passage par la page de paiement hébergée par Stripe.
 */
import { expect, test } from "@playwright/test";
import { createConfirmedUser, login, resetRateLimits, sql, uniqueEmail } from "./helpers";

test.describe("abonnements (Stripe en mode test)", () => {
  test.beforeEach(resetRateLimits);

  test("essai de 72 h : conditions affichées, confirmation obligatoire, paiement hébergé par Stripe", async ({ page }) => {
    const u = await createConfirmedUser(uniqueEmail("trial"), { plan: null });
    await login(page, u.email, undefined, "/app/abonnement/essai?formule=plus");
    await page.waitForURL(/abonnement\/essai/);
    await expect(page.getByRole("heading", { name: "Démarrer l'essai Plus" })).toBeVisible();
    await expect(page.getByText("Pendant l'essai")).toBeVisible();
    await expect(page.getByText(/72/).first()).toBeVisible();
    const go = page.getByRole("button", { name: "Continuer vers le paiement sécurisé" });
    await expect(go).toBeDisabled();
    await page.getByLabel(/le prélèvement mensuel commencera à la fin de l'essai/).check();

    // La carte n'est jamais saisie sur Watchly : redirection vers la page Checkout de Stripe.
    let checkoutUrl = "";
    await page.route(/^https:\/\/checkout\.stripe\.com\//, async (route) => {
      checkoutUrl = route.request().url();
      await route.fulfill({ status: 200, contentType: "text/html", body: "<title>Stripe Checkout (simulé)</title>" });
    });
    await go.click();
    await page.waitForURL(/checkout\.stripe\.com/);
    expect(checkoutUrl).toMatch(/^https:\/\/checkout\.stripe\.com\//);
    expect(await page.content()).not.toMatch(/card-number|cvc/i);
  });

  test("formule inconnue ou gratuite : aucune session de paiement", async ({ page }) => {
    const u = await createConfirmedUser(uniqueEmail("plan"), { plan: null });
    await login(page, u.email);
    await page.waitForURL(/\/app/);
    const headers = { origin: "http://localhost:3000" };
    for (const planId of ["discovery", "gratuit-illimite", "business_extra_site"]) {
      const r = await page.request.post("/api/billing/checkout", { data: { planId, acknowledged: true }, headers });
      expect(r.status(), planId).toBeGreaterThanOrEqual(400);
      expect(r.status(), planId).toBeLessThan(500);
    }
    // Les droits ne peuvent pas être modifiés depuis le navigateur.
    const forged = await page.request.patch("/api/account/profile", { data: { planId: "business", role: "admin" }, headers });
    expect(forged.status()).toBe(400);
    const [ent] = await sql<{ plan_id: string | null }[]>`select plan_id from entitlements where user_id = ${u.id}`;
    expect(ent?.plan_id ?? null).toBeNull();
  });

  test("essai en cours : date du premier prélèvement et résiliation sans frais", async ({ page }) => {
    const u = await createConfirmedUser(uniqueEmail("cancel"), { plan: null });
    // État équivalent à la réception du webhook « essai démarré » (testé en intégration).
    await sql`insert into subscriptions (user_id, plan_id, stripe_subscription_id, stripe_customer_id, status, trial_start, trial_end, current_period_end)
              values (${u.id}, 'pro', ${"sub_e2e_" + u.id}, ${"cus_e2e_" + u.id}, 'trialing', now(), now() + interval '72 hours', now() + interval '72 hours')`;
    await sql`delete from entitlements where user_id = ${u.id}`;
    await login(page, u.email, undefined, "/app/abonnement");
    await page.waitForURL(/\/app\/abonnement$/);
    await expect(page.getByRole("heading", { name: "Formule Pro" })).toBeVisible();
    await expect(page.getByText(/Premier prélèvement à cette date, sauf résiliation/)).toBeVisible();
    await page.getByRole("link", { name: "Résilier" }).click();
    await expect(page.getByRole("heading", { name: "Résilier mon abonnement" })).toBeVisible();
    await page.getByRole("button", { name: "Confirmer la résiliation" }).click();
    await expect(page.getByText("Résiliation enregistrée").first()).toBeVisible();
    await page.waitForURL(/\/app\/abonnement$/);
  });
});
