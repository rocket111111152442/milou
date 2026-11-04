/**
 * Compte sans formule : accueil complet SANS menu de navigation ; paramètres refondus (sections, apparence, sessions) ;
 * animation de confirmation d'achat. Base locale jetable, aucun site tiers contacté, aucun paiement.
 */
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { createConfirmedUser, login, resetRateLimits, sql, uniqueEmail } from "./helpers";

/** Connexion terminée (le helper `login` ne l'attend pas). */
async function signIn(page: Page, email: string) {
  await login(page, email);
  await page.waitForURL(/\/app/);
}

const ORIGIN = { origin: "http://localhost:3000" };

async function audit(page: Page, label: string) {
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await page.waitForTimeout(400);
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  const bad = r.violations.filter((v) => v.impact === "critical" || v.impact === "serious");
  expect(bad.map((v) => `${label}: ${v.id} (${v.nodes.length}) ${v.nodes[0]?.target?.join(" ")}`)).toEqual([]);
}

test.describe("compte sans formule", () => {
  test.beforeEach(resetRateLimits);

  test("accueil complet sans menu ; les autres pages renvoient au choix de la formule", async ({ page }) => {
    const u = await createConfirmedUser(uniqueEmail("gate"), { plan: null });
    await signIn(page, u.email);
    await page.goto("/app");
    await expect(page).toHaveURL(/\/app\/abonnement/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Votre espace est prêt");
    // Aucun menu de navigation : ni barre latérale, ni onglets du bas.
    await expect(page.getByRole("navigation", { name: "Navigation principale" })).toHaveCount(0);
    await expect(page.getByRole("navigation", { name: "Navigation rapide" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Mes surveillances" })).toHaveCount(0);
    // Mode d'emploi, fonctions à débloquer, formules, comparatif et questions.
    await expect(page.getByRole("heading", { name: "Mode d'emploi en quatre étapes" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Ce que vous débloquez avec une formule" })).toBeVisible();
    await expect(page.getByRole("heading", { name: /^Choisir une formule/ })).toBeVisible();
    await expect(page.getByRole("table", { name: /Comparatif détaillé des formules/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Questions fréquentes" })).toBeVisible();
    // Les pages réservées aux abonnés renvoient ici.
    for (const path of ["/app/surveillances/nouvelle", "/app/alertes", "/app/historique", "/app/surveillances"]) {
      await page.goto(path);
      await expect(page, path).toHaveURL(/\/app\/abonnement/);
    }
    // Paramètres et aide restent accessibles, sans menu.
    await page.goto("/app/parametres");
    await expect(page.getByRole("heading", { level: 1, name: "Paramètres" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Navigation principale" })).toHaveCount(0);
    await page.goto("/app/aide");
    await expect(page).toHaveURL(/\/app\/aide/);
  });

  test("« Changer de compte » déconnecte et ouvre la connexion", async ({ page }) => {
    const u = await createConfirmedUser(uniqueEmail("switch"), { plan: null });
    await signIn(page, u.email);
    await page.goto("/app/abonnement");
    await page.getByRole("button", { name: "Menu du compte" }).click();
    await page.getByRole("menuitem", { name: "Changer de compte" }).click();
    await expect(page).toHaveURL(/\/connexion/);
    await page.goto("/app/abonnement");
    await expect(page).toHaveURL(/\/connexion/);
  });

  test("le menu complet apparaît avec une formule active", async ({ page }) => {
    const u = await createConfirmedUser(uniqueEmail("plan"), { plan: "plus" });
    await signIn(page, u.email);
    await page.goto("/app");
    await expect(page).toHaveURL(/\/app$/);
    await expect(page.getByRole("navigation", { name: "Navigation principale" }).getByRole("link", { name: "Mes surveillances" })).toBeVisible();
  });

  test("API : fermeture des autres sessions réservée au compte connecté, même origine uniquement", async ({ page, request }) => {
    expect((await request.delete("/api/account/sessions", { headers: ORIGIN })).status()).toBe(401);
    const u = await createConfirmedUser(uniqueEmail("csrf"), { plan: "plus" });
    await signIn(page, u.email);
    expect((await page.request.delete("/api/account/sessions", { headers: { origin: "https://autre-site.example" } })).status()).toBe(403);
  });

  test("accessibilité : accueil sans formule et paramètres (axe), ordinateur et téléphone", async ({ page }) => {
    test.setTimeout(120_000);
    await page.emulateMedia({ reducedMotion: "reduce" });
    const u = await createConfirmedUser(uniqueEmail("a11ygate"), { plan: null });
    await signIn(page, u.email);
    for (const size of [{ width: 1366, height: 900 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(size);
      await page.goto("/app/abonnement");
      await audit(page, `accueil sans formule ${size.width}`);
      await page.goto("/app/parametres");
      await audit(page, `paramètres ${size.width}`);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `paramètres ${size.width} : défilement horizontal`).toBeLessThanOrEqual(1);
    }
  });
});

test.describe("paramètres", () => {
  test.beforeEach(resetRateLimits);

  test("sections, absence du bouton d'export, apparence persistante, sessions", async ({ page, browser }) => {
    test.setTimeout(120_000);
    const u = await createConfirmedUser(uniqueEmail("settings"), { plan: "pro" });
    await signIn(page, u.email);
    await page.goto("/app/parametres");
    for (const name of ["Profil", "Notifications", "Apparence et accessibilité", "Sécurité", "Appareils et applications", "Confidentialité et données"]) {
      await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
    }
    const nav = page.getByRole("navigation", { name: "Sections des paramètres" });
    await expect(nav.getByRole("link", { name: "Apparence" })).toBeVisible();
    // Le bouton d'export a été retiré de la page ; la suppression du compte reste disponible.
    await expect(page.getByText("Exporter mes données")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Supprimer" })).toBeVisible();

    // Apparence : réelle (attributs sur <html>) et conservée après rechargement.
    await page.getByRole("radio", { name: /Réduites/ }).click();
    await page.getByRole("radio", { name: /Agrandie/ }).click();
    await page.getByRole("radio", { name: /Renforcé/ }).click();
    await expect(page.locator("html")).toHaveAttribute("data-motion", "reduced");
    await expect(page.locator("html")).toHaveAttribute("data-text", "large");
    await expect(page.locator("html")).toHaveAttribute("data-contrast", "high");
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-motion", "reduced");
    await page.getByRole("radio", { name: /Complètes/ }).click();
    await expect(page.locator("html")).not.toHaveAttribute("data-motion", "reduced");

    // Sessions : une seconde session apparaît, puis la fermeture des autres la déconnecte réellement.
    await page.getByRole("button", { name: /Aucune autre session/ }).waitFor();
    const other = await browser.newContext();
    const second = await other.newPage();
    await signIn(second, u.email);
    await second.goto("/app");
    await expect(second).toHaveURL(/\/app$/);
    await page.reload();
    await expect(page.getByText("Cette session")).toBeVisible();
    await page.getByRole("button", { name: /Fermer les 1 autre session/ }).click();
    await expect(page.getByRole("button", { name: /Aucune autre session/ })).toBeVisible();
    await second.goto("/app");
    await expect(second).toHaveURL(/\/connexion/);
    await expect(page.getByText("Cette session")).toBeVisible();
    await other.close();
    // La route d'export reste en place (non exposée dans l'interface) pour le droit d'accès sur demande.
    expect((await page.request.get("/api/account/export")).status()).toBe(200);
    expect((await sql`select 1 from user_sessions where user_id = ${u.id}`).length).toBe(1);
  });
});

test.describe("animation d'achat validé", () => {
  test.beforeEach(resetRateLimits);

  test("boîte de dialogue accessible : titre, focus, Échap, durée de l'essai", async ({ page }) => {
    const u = await createConfirmedUser(uniqueEmail("celebrate"), { plan: "pro", status: "trialing" });
    await signIn(page, u.email);
    await page.goto("/app/abonnement/apercu-achat");
    // Désactivé hors recette (comme en Production) : la page « introuvable » peut être servie avec un statut 200 (réponse en flux).
    const enabled = (await page.getByText("Aperçu de l'animation d'achat validé").count()) > 0;
    test.skip(!enabled, "outil de recette désactivé sur cet environnement (WAVERTI_BILLING_TEST_TOOLS)");
    const dialog = page.getByRole("dialog", { name: "Achat validé !" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(/essai gratuit de 3 jours/)).toBeVisible();
    await expect(dialog.getByRole("link", { name: /Découvrir Waverti/ })).toBeFocused();
    await audit(page, "animation d'achat");
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
  });
});
