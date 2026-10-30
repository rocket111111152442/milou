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
