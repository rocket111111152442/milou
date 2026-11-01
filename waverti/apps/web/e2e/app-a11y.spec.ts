/**
 * Accessibilité de l'espace connecté : audit automatisé (axe, WCAG 2.1 AA) sur les écrans principaux et chaque étape de
 * l'assistant de création, ordinateur et téléphone ; parcours au clavier ; absence de défilement horizontal.
 * Base locale jetable, aucun site tiers contacté.
 */
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { createConfirmedUser, login, resetRateLimits, sql, uniqueEmail } from "./helpers";

async function audit(page: Page, label: string) {
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await page.waitForTimeout(400);
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  const bad = r.violations.filter((v) => v.impact === "critical" || v.impact === "serious");
  expect(bad.map((v) => `${label}: ${v.id} (${v.nodes.length}) ${v.nodes[0]?.target?.join(" ")}`)).toEqual([]);
}

for (const device of [
  { name: "ordinateur", viewport: { width: 1366, height: 900 } },
  { name: "téléphone", viewport: { width: 390, height: 844 } },
]) {
  test.describe(`accessibilité — ${device.name}`, () => {
    test.use({ viewport: device.viewport });
    test.beforeEach(resetRateLimits);

    test("écrans principaux et assistant en 5 étapes : aucune violation critique ou grave (axe)", async ({ page }) => {
      test.setTimeout(180_000);
      await page.emulateMedia({ reducedMotion: "reduce" });
      const u = await createConfirmedUser(uniqueEmail("a11y"), { plan: "pro" });
      await login(page, u.email);
      await page.waitForURL(/\/app/);
      await audit(page, "accueil (vide)");
      for (const [path, name] of [
        ["/app/surveillances", "liste vide"],
        ["/app/alertes", "alertes vides"],
        ["/app/historique", "historique"],
        ["/app/abonnement", "abonnement"],
        ["/app/parametres", "paramètres"],
        ["/app/aide", "aide"],
      ] as const) {
        await page.goto(path);
        await audit(page, name);
      }
      // Assistant : chaque étape.
      await page.goto("/app/surveillances/nouvelle");
      await audit(page, "assistant étape 1");
      await page.getByRole("listitem").filter({ hasText: "Prix" }).first().click();
      await audit(page, "assistant étape 2");
      await page.getByLabel(/^Adresse/).fill("https://boutique.example.com/casque");
      await page.getByRole("button", { name: /Continuer/ }).click();
      await audit(page, "assistant étape 3");
      await page.getByLabel("Montant en euros").fill("99");
      await page.getByRole("button", { name: /Continuer/ }).click();
      await audit(page, "assistant étape 4");
      await page.getByRole("button", { name: /Continuer/ }).click();
      await audit(page, "assistant étape 5");
      await page.getByLabel(/^Nom de la surveillance/).fill("Casque (a11y)");
      await page.getByRole("button", { name: "Activer la surveillance" }).click();
      await page.waitForURL(/\/app\/surveillances\/[0-9a-f-]{36}$/);
      const id = page.url().split("/").pop()!;
      await sql`insert into notifications (user_id, type, title, body, task_id) values (${u.id}, 'price', 'Alerte de test', 'Créée pour le test', ${id})`;
      await audit(page, "détail d'une surveillance");
      for (const [path, name] of [
        ["/app", "accueil (avec données)"],
        ["/app/surveillances", "liste"],
        ["/app/alertes", "alertes"],
      ] as const) {
        await page.goto(path);
        await audit(page, name);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow, `${name} : défilement horizontal`).toBeLessThanOrEqual(1);
      }
    });
  });
}

test.describe("clavier", () => {
  test.beforeEach(resetRateLimits);

  test("lien d'évitement, assistant utilisable sans souris, focus sur le titre de chaque étape", async ({ page }) => {
    const u = await createConfirmedUser(uniqueEmail("kbd"), { plan: "pro" });
    await login(page, u.email);
    await page.waitForURL(/\/app/);
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Aller au contenu" })).toBeFocused();

    await page.goto("/app/surveillances/nouvelle");
    const tile = page.getByRole("listitem").filter({ hasText: "Prix" }).first();
    await tile.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { name: "Quel site ou quel produit ?" })).toBeFocused();
    await page.getByLabel(/^Adresse/).fill("https://boutique.example.com/casque");
    await page.getByRole("button", { name: /Continuer/ }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { name: "Quel changement souhaitez-vous détecter ?" })).toBeFocused();
    // Les objectifs sont un groupe de boutons radio : accessibles et activables au clavier.
    const goal = page.getByRole("radio", { name: /Toute baisse de prix/ });
    if (await goal.count()) {
      await goal.first().focus();
      await page.keyboard.press("Enter");
      await expect(goal.first()).toHaveAttribute("aria-checked", "true");
    }
    await page.getByRole("button", { name: /Continuer/ }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { name: "Comment souhaitez-vous être prévenu ?" })).toBeFocused();
    await page.getByRole("button", { name: /Continuer/ }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { name: "Vérifier et activer" })).toBeFocused();
  });

  test("téléphone : la barre d'onglets du bas est présente et navigable", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const u = await createConfirmedUser(uniqueEmail("tabs"), { plan: "pro" });
    await login(page, u.email);
    await page.waitForURL(/\/app/);
    const tabs = page.getByRole("navigation", { name: "Navigation rapide" });
    await expect(tabs).toBeVisible();
    await tabs.getByRole("link", { name: "Alertes" }).click();
    await expect(page).toHaveURL(/\/app\/alertes/);
    await expect(tabs.getByRole("link", { name: "Alertes" })).toHaveAttribute("aria-current", "page");
  });
});
