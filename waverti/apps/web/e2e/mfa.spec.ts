import { expect, test } from "@playwright/test";
import { createConfirmedUser, enableMfa, login, PASSWORD, resetRateLimits, sql, totp, uniqueEmail } from "./helpers";

const ORIGIN = { origin: "http://localhost:3000" };

/** Attend le pas TOTP suivant (le même code ne peut pas servir deux fois : protection anti-rejeu). */
async function nextTotpWindow() {
  const wait = 30_000 - (Date.now() % 30_000) + 300;
  await new Promise((r) => setTimeout(r, wait));
}

test.describe("double authentification (TOTP) et codes de récupération", () => {
  test.beforeEach(resetRateLimits);

  test("activation, code exigé à la connexion, codes de récupération à usage unique, désactivation", async ({ page, browser }) => {
    test.setTimeout(120_000);
    const u = await createConfirmedUser(uniqueEmail("mfa"));
    await login(page, u.email);
    await page.waitForURL(/\/app/);
    await page.goto("/app/parametres");
    // Un code faux ne confirme rien.
    expect((await page.request.post("/api/account/mfa/verify", { data: { code: "123456" }, headers: ORIGIN })).status()).toBe(422);
    const { secret, codes } = await enableMfa(page);
    expect(codes).toHaveLength(10);
    // Le secret est chiffré en base, jamais stocké en clair.
    const [row] = await sql<{ totp_secret_enc: string }[]>`select totp_secret_enc from users where id = ${u.id}`;
    expect(row!.totp_secret_enc).toMatch(/^v1\./);
    expect(row!.totp_secret_enc).not.toContain(secret);

    // Changer de mot de passe ne fait pas perdre la validation de la session courante.
    const pw = await page.request.post("/api/account/password", { data: { current: PASSWORD, next: `${PASSWORD}-2` }, headers: ORIGIN });
    expect(pw.status()).toBe(200);
    expect((await page.request.get("/api/monitors")).status()).toBe(200);

    // Nouvelle connexion : le mot de passe seul n'ouvre rien.
    const ctx = await browser.newContext();
    const other = await ctx.newPage();
    await login(other, u.email, `${PASSWORD}-2`);
    await other.waitForURL(/\/connexion\/double-authentification/);
    expect((await other.request.get("/api/monitors")).status()).toBe(401);
    // Une demande d'assistance envoyée sans le code n'est pas rattachée au compte.
    const subject = `Sans code ${Date.now()}`;
    const ticket = await other.request.post("/api/support", { data: { email: "tiers@example.test", subject, message: "Message envoyé avant le code." }, headers: ORIGIN });
    expect(ticket.status()).toBe(201);
    const [t] = await sql<{ user_id: string | null }[]>`select user_id from support_tickets where subject = ${subject}`;
    expect(t).toEqual({ user_id: null });
    await other.goto("/app/surveillances");
    await expect(other).toHaveURL(/\/connexion\/double-authentification\?suivant=%2Fapp%2Fsurveillances/);
    // Code TOTP déjà utilisé pour l'activation (même fenêtre de 30 s) : refusé (anti-rejeu).
    const used = totp(secret);
    await other.getByLabel(/^Code/).fill(used === "000000" ? "111111" : "000000");
    await other.getByRole("button", { name: "Vérifier" }).click();
    await expect(other.getByText(/Code incorrect ou expiré/)).toBeVisible();
    // Code de récupération : accepté une fois.
    await other.getByLabel(/^Code/).fill(codes[0]!);
    await other.getByRole("button", { name: "Vérifier" }).click();
    await other.waitForURL(/\/app\/parametres\?code-recuperation=utilise/);
    await expect(other.getByText(/Vous vous êtes connecté avec un code de récupération/)).toBeVisible();
    await expect(other.getByText(/Codes de récupération restants/)).toContainText("9");
    expect((await other.request.get("/api/monitors")).status()).toBe(200);
    await ctx.close();

    // Le même code de récupération ne fonctionne plus.
    const ctx2 = await browser.newContext();
    const third = await ctx2.newPage();
    await login(third, u.email, `${PASSWORD}-2`);
    await third.waitForURL(/\/connexion\/double-authentification/);
    await third.getByLabel(/^Code/).fill(codes[0]!);
    await third.getByRole("button", { name: "Vérifier" }).click();
    await expect(third.getByText(/Code incorrect ou expiré/)).toBeVisible();
    await nextTotpWindow();
    await third.getByLabel(/^Code/).fill(totp(secret));
    await third.getByRole("button", { name: "Vérifier" }).click();
    await third.waitForURL(/\/app/);
    await ctx2.close();

    // Désactivation : un code (ici de récupération) est exigé.
    await page.reload();
    await page.getByLabel(/^Code à 6 chiffres/).fill(codes[1]!);
    await page.getByRole("button", { name: "Désactiver la double authentification" }).click();
    await expect(page.getByRole("button", { name: "Activer la double authentification" })).toBeVisible();
    await expect
      .poll(async () => (await sql<{ n: number }[]>`select count(*)::int as n from mfa_recovery_codes where user_id = ${u.id}`)[0]!.n)
      .toBe(0);
    const [state] = await sql<{ enabled: Date | null }[]>`select totp_enabled_at as enabled from users where id = ${u.id}`;
    expect(state!.enabled).toBeNull();
  });
});
