import { expect, test } from "@playwright/test";
import { createConfirmedUser, enableMfa, login, PASSWORD, resetRateLimits, totp, uniqueEmail } from "./helpers";

const ORIGIN = { origin: "http://localhost:3000" };

test.describe("double authentification (TOTP)", () => {
  test.beforeEach(resetRateLimits);

  test("activation, code exigé à la connexion, session sans code refusée, désactivation", async ({ page, browser }) => {
    const u = await createConfirmedUser(uniqueEmail("mfa"));
    await login(page, u.email);
    await page.waitForURL(/\/app/);
    await page.goto("/app/parametres");
    // Un code faux ne confirme rien.
    expect((await page.request.post("/api/account/mfa/verify", { data: { factorId: "00000000-0000-4000-8000-000000000000", code: "123456" }, headers: ORIGIN })).status()).toBe(422);
    const secret = await enableMfa(page);

    // Changer de mot de passe ne fait pas perdre la validation de la session (vérification sans session).
    const pw = await page.request.post("/api/account/password", { data: { current: PASSWORD, next: `${PASSWORD}-2` }, headers: ORIGIN });
    expect(pw.status()).toBe(200);
    expect((await page.request.get("/api/monitors")).status()).toBe(200);

    // Nouvelle connexion : le mot de passe seul n'ouvre rien.
    const ctx = await browser.newContext();
    const other = await ctx.newPage();
    await login(other, u.email, `${PASSWORD}-2`);
    await other.waitForURL(/\/connexion\/double-authentification/);
    expect((await other.request.get("/api/monitors")).status()).toBe(401);
    await other.goto("/app/surveillances");
    await expect(other).toHaveURL(/\/connexion\/double-authentification\?suivant=%2Fapp%2Fsurveillances/);
    await other.getByLabel(/^Code à 6 chiffres/).fill(totp(secret) === "000000" ? "111111" : "000000");
    await other.getByRole("button", { name: "Vérifier" }).click();
    await expect(other.getByText(/Code incorrect ou expiré/)).toBeVisible();
    await other.getByLabel(/^Code à 6 chiffres/).fill(totp(secret));
    await other.getByRole("button", { name: "Vérifier" }).click();
    await other.waitForURL(/\/app\/surveillances$/);
    expect((await other.request.get("/api/monitors")).status()).toBe(200);
    await ctx.close();

    // Désactivation : un code valide est exigé.
    await page.reload();
    await page.getByLabel(/^Code à 6 chiffres/).fill(totp(secret));
    await page.getByRole("button", { name: "Désactiver la double authentification" }).click();
    await expect(page.getByRole("button", { name: "Activer la double authentification" })).toBeVisible();
  });
});
