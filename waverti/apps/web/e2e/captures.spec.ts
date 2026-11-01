/**
 * Captures d'écran avant/après (jamais exécutées dans la suite normale) :
 *   CAPTURE_DIR=docs/captures/refonte-2/avant [CAPTURE_VIEWPORT=mobile] E2E_BASE_URL=http://localhost:3000 pnpm --filter @waverti/web exec playwright test captures
 * Données : base LOCALE jetable, comptes et surveillances de test créés par ce script (aucune donnée réelle, aucun site tiers contacté).
 */
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { createConfirmedUser, login, resetRateLimits, sql, uniqueEmail } from "./helpers";

const DIR = process.env.CAPTURE_DIR;
test.skip(!DIR, "CAPTURE_DIR non défini : captures désactivées");

async function shot(page: Page, name: string, fullPage = true) {
  mkdirSync(resolve(DIR!), { recursive: true });
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await page.waitForTimeout(700);
  await page.screenshot({ path: resolve(DIR!, `${name}-${process.env.CAPTURE_VIEWPORT === "mobile" ? "mobile" : "ordinateur"}.png`), fullPage });
}

async function createRule(page: Page, name: string, url: string, amount: string) {
  await page.goto("/app/surveillances/nouvelle");
  await page.getByRole("listitem").filter({ hasText: "Prix" }).first().click();
  await page.getByLabel(/^Adresse/).fill(url);
  const amountField = page.getByLabel("Montant en euros");
  const nameField = page.getByLabel(/^Nom de la surveillance/);
  // Compatible avec l'ancien parcours (3 étapes) et le nouveau (5 étapes).
  for (let i = 0; i < 6 && !(await nameField.isVisible()); i++) {
    if (await amountField.isVisible()) await amountField.fill(amount);
    await page.getByRole("button", { name: /Continuer/ }).click();
    await page.waitForTimeout(150);
  }
  await nameField.fill(name);
  await page.getByRole("button", { name: /^(Créer|Activer) la surveillance$/ }).click();
  await page.waitForURL(/\/app\/surveillances\/[0-9a-f-]{36}$/);
  return page.url().split("/").pop()!;
}

test("captures", async ({ page }) => {
  test.setTimeout(180_000);
  if (process.env.CAPTURE_VIEWPORT === "mobile") await page.setViewportSize({ width: 412, height: 915 });
  else await page.setViewportSize({ width: 1366, height: 900 });
  await resetRateLimits();
  // 1. Compte neuf (états vides)
  const empty = await createConfirmedUser(uniqueEmail("vide"), { plan: "pro" });
  await login(page, empty.email);
  await page.waitForURL(/\/app/);
  await shot(page, "01-accueil-vide");
  await page.goto("/app/surveillances");
  await shot(page, "02-liste-vide");
  await page.goto("/app/alertes");
  await shot(page, "03-alertes-vide");
  await page.goto("/app/surveillances/nouvelle");
  await shot(page, "04-creation-etape1");
  await page.getByRole("listitem").filter({ hasText: "Prix" }).first().click();
  await shot(page, "05-creation-etape2");
  await page.goto("/app/produits");
  await shot(page, "06-produits");
  await page.context().clearCookies();

  // 2. Compte avec surveillances et alertes de test
  const u = await createConfirmedUser(uniqueEmail("actif"), { plan: "pro" });
  await login(page, u.email);
  await page.waitForURL(/\/app/);
  const ids = [
    await createRule(page, "Casque audio (test)", "https://boutique.example.com/casque", "99"),
    await createRule(page, "Aspirateur robot (test)", "https://boutique.example.com/aspirateur", "250"),
    await createRule(page, "Clavier mécanique (test)", "https://boutique.example.com/clavier", "60"),
  ];
  await sql`insert into notifications (user_id, type, title, body, task_id) values
    (${(u as {id:string}).id}, 'price', 'Alerte de test : prix sous le seuil', 'Notification créée localement pour la capture', ${ids[0]!}),
    (${(u as {id:string}).id}, 'price', 'Alerte de test : nouveau contrôle', 'Notification créée localement pour la capture', ${ids[1]!})`;
  await page.goto("/app");
  await shot(page, "10-accueil-actif");
  await page.goto("/app/surveillances");
  await shot(page, "11-liste");
  await page.goto(`/app/surveillances/${ids[0]}`);
  await shot(page, "12-detail");
  await page.goto("/app/alertes");
  await shot(page, "13-alertes");
  await page.goto("/app/historique");
  await shot(page, "14-historique");
  await page.goto("/app/abonnement");
  await shot(page, "15-abonnement");
  await page.goto("/app/parametres");
  await shot(page, "16-parametres");
  await page.goto("/app/aide");
  await shot(page, "17-aide");
  await expect(page).toHaveURL(/aide/);
  // Assistant en 5 étapes (n'existe que dans la nouvelle version)
  if (process.env.CAPTURE_WIZARD) {
    await page.goto("/app/surveillances/nouvelle?categorie=price");
    await page.getByLabel(/^Adresse/).fill("https://boutique.example.com/casque");
    await shot(page, "20-assistant-2-site");
    await page.getByRole("button", { name: /Continuer/ }).click();
    await shot(page, "21-assistant-3-changement");
    await page.getByLabel("Montant en euros").fill("99");
    await page.getByRole("button", { name: /Continuer/ }).click();
    await shot(page, "22-assistant-4-alertes");
    await page.getByRole("button", { name: /Continuer/ }).click();
    await shot(page, "23-assistant-5-activation");
  }
});
