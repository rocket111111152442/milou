/**
 * Captures de la refonte « accueil, compte sans formule, paramètres, animation d'achat » (jamais dans la suite normale) :
 *   CAPTURE_DIR=docs/captures/refonte-4/apres [CAPTURE_VIEWPORT=mobile] E2E_BASE_URL=http://localhost:3000 pnpm --filter @waverti/web exec playwright test captures-v4
 * Base LOCALE jetable ; comptes « (test) » créés par ce script ; aucun site tiers contacté.
 */
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { test, type Page } from "@playwright/test";
import { createConfirmedUser, login, resetRateLimits, uniqueEmail } from "./helpers";

const DIR = process.env.CAPTURE_DIR;
test.skip(!DIR, "CAPTURE_DIR non défini : captures désactivées");
const mobile = process.env.CAPTURE_VIEWPORT === "mobile";

async function shot(page: Page, name: string, fullPage = true) {
  mkdirSync(resolve(DIR!), { recursive: true });
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await page.waitForTimeout(900);
  await page.screenshot({ path: resolve(DIR!, `${name}-${mobile ? "mobile" : "ordinateur"}.png`), fullPage });
}

/** Attend l'hydratation puis fait défiler lentement pour déclencher les apparitions au défilement. */
async function reveal(page: Page) {
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await page.waitForTimeout(800);
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 300) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 120));
    }
    window.scrollTo(0, 0);
    await new Promise((r) => setTimeout(r, 400));
  });
}

test("captures v4", async ({ page }) => {
  test.setTimeout(240_000);
  await page.setViewportSize(mobile ? { width: 412, height: 915 } : { width: 1366, height: 900 });
  await resetRateLimits();

  // Page d'accueil publique (défilement pour révéler les sections)
  await page.goto("/");
  await reveal(page);
  await shot(page, "01-accueil-public");
  await shot(page, "02-accueil-public-premier-ecran", false);

  // Compte SANS formule : accueil verrouillé
  const free = await createConfirmedUser(uniqueEmail("sansformule"), { plan: null });
  await login(page, free.email);
  await page.waitForURL(/\/app/);
  await page.goto("/app");
  await page.waitForURL(/abonnement/);
  await reveal(page);
  await shot(page, "10-sans-formule");
  await shot(page, "11-sans-formule-premier-ecran", false);
  await page.goto("/app/parametres");
  await shot(page, "12-parametres-sans-formule");
  await page.context().clearCookies();

  // Compte en essai : abonnement, paramètres, animation d'achat
  const trial = await createConfirmedUser(uniqueEmail("essai"), { plan: "pro", status: "trialing" });
  await login(page, trial.email);
  await page.waitForURL(/\/app/);
  await page.goto("/app/abonnement");
  await shot(page, "20-abonnement-essai");
  await page.goto("/app/parametres");
  await shot(page, "21-parametres");
  await page.goto("/app/abonnement/apercu-achat");
  await page.waitForTimeout(1800);
  await shot(page, "22-animation-achat", false);
});
