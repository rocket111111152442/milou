import { expect, test } from "@playwright/test";

test("mobile : menu, pas de défilement horizontal", async ({ page }) => {
  for (const path of ["/", "/tarifs", "/entreprises", "/inscription"]) {
    await page.goto(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, path).toBeLessThanOrEqual(1);
  }
  await page.goto("/");
  await page.getByRole("button", { name: "Ouvrir le menu" }).click();
  await expect(page.getByRole("navigation", { name: "Navigation mobile" })).toBeVisible();
  await page.getByRole("navigation", { name: "Navigation mobile" }).getByRole("link", { name: "Tarifs" }).click();
  await expect(page).toHaveURL(/\/tarifs/);
});

test("mobile : espace client utilisable sur téléphone (tableau de bord, surveillances, alertes, paramètres, abonnement)", async ({ page }) => {
  const { createConfirmedUser, login, resetRateLimits, uniqueEmail } = await import("./helpers");
  await resetRateLimits();
  const u = await createConfirmedUser(uniqueEmail("mobile"));
  await login(page, u.email);
  await page.waitForURL(/\/app/);
  for (const path of ["/app", "/app/surveillances", "/app/surveillances/nouvelle", "/app/alertes", "/app/historique", "/app/parametres", "/app/abonnement"]) {
    await page.goto(path);
    await expect(page.locator("h1").first(), path).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, path).toBeLessThanOrEqual(1);
  }
});
