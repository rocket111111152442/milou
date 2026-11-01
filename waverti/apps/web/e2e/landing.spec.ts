import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.describe("site public", () => {
  test("la page d'accueil présente toutes les sections sans erreur", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => m.type() === "error" && !m.text().includes("404") && errors.push(m.text()));
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Un prix baisse. Une place se libère.");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Vous êtes prévenu.");
    for (const name of [
      "Comment ça marche",
      "Que voulez-vous suivre ?",
      "Sur quelle page ?",
      "Quand être averti ?",
      "Ce que vous pouvez confier à Waverti",
      "Soyez le premier informé quand votre site a un problème.",
      "Quatre formules, sans engagement",
      "Les réponses essentielles",
      "Arrêtez de vérifier. Soyez prévenu.",
    ]) {
      await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
    }
    await expect(page.getByText("WAVERTI — Développé par")).toBeVisible();
    await expect(page.getByRole("link", { name: "LULLIN WEB" }).first()).toHaveAttribute("href", "https://www.lullin-web.com");
    expect(errors).toEqual([]);
  });

  test("accueil : boutons principaux, ancre et formules", async ({ page }) => {
    await page.goto("/");
    const main = page.getByRole("main");
    await expect(main.getByRole("link", { name: "Commencer" }).first()).toHaveAttribute("href", "/inscription");
    await main.getByRole("link", { name: "Voir comment ça marche" }).click();
    await expect(page).toHaveURL(/#comment-ca-marche$/);
    await expect(page.getByRole("heading", { name: "Comment ça marche", exact: true })).toBeInViewport();
    for (const price of ["5,99 €", "14,99 €", "29,99 €", "39,99 €"]) await expect(main.getByText(price).first()).toBeVisible();
    for (const plan of ["plus", "pro", "max", "business"]) await expect(main.locator(`a[href="/inscription?formule=${plan}"]`)).toHaveCount(1);
    await expect(main.getByRole("link", { name: /Découvrir Waverti Business/ })).toHaveAttribute("href", "/entreprises");
    // Aucun téléchargement proposé depuis l'accueil tant qu'aucune version n'est publiée.
    await expect(page.getByRole("banner").getByRole("link", { name: /Télécharger/ })).toHaveCount(0);
    await expect(main.getByRole("link", { name: /Télécharger/ })).toHaveCount(0);
  });

  test("la démonstration de l'accueil est étiquetée et fonctionne sans appel réseau", async ({ page }) => {
    const apiCalls: string[] = [];
    page.on("request", (r) => r.url().includes("/api/") && apiCalls.push(r.url()));
    await page.goto("/");
    await expect(page.getByText("Exemple de fonctionnement")).toBeVisible();
    await expect(page.getByText("Vérifié à 9 h 00").first()).toBeVisible();
    await expect(page.getByText(/Contrôle de 9|contrôle sur votre PC|Alerte envoyée/i)).toHaveCount(0);
    await page.getByRole("tab", { name: "Une billetterie" }).click();
    await expect(page.getByRole("tab", { name: "Une billetterie" })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByText("Vérification toutes les 2 heures (formule Pro)")).toBeVisible();
    await page.getByRole("tab", { name: "Une billetterie" }).press("ArrowRight");
    await expect(page.getByRole("tab", { name: "Un retour en stock" })).toBeFocused();
    await expect(page.getByText("Canapé convertible", { exact: true })).toBeVisible();
    expect(apiCalls).toEqual([]);
  });

  test("aucun téléchargement actif n'est proposé sans version publiée", async ({ page }) => {
    await page.goto("/telecharger");
    await expect(page.getByText("Bientôt disponible")).toHaveCount(3);
    await expect(page.locator('a[href$=".msi"], a[href$=".dmg"], a[href$=".AppImage"], a[href$=".deb"]')).toHaveCount(0);
  });

  test("tarifs : 4 formules payantes avec essai de 3 jours, aucune formule gratuite", async ({ page }) => {
    await page.goto("/tarifs");
    for (const price of ["5,99 €", "14,99 €", "29,99 €", "39,99 €"]) await expect(page.getByText(price, { exact: false }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /Essayer Max gratuitement pendant 3 jours/ })).toBeVisible();
    await expect(page.getByText("0 €", { exact: true })).toHaveCount(0);
    await expect(page.getByText(/pour toujours|sans carte bancaire/i)).toHaveCount(0);
    await expect(page.getByRole("table", { name: /Comparatif/ })).toBeVisible();
  });

  test("l'option abandonnée « site supplémentaire » n'apparaît sur aucune page commerciale", async ({ request }) => {
    for (const path of ["/", "/tarifs", "/entreprises", "/surveillance-site-entreprise", "/detecter-panne-site-internet"]) {
      const html = await (await request.get(path)).text();
      expect(html, path).not.toMatch(/sites? (professionnels? )?supplémentaires?/i);
    }
  });

  test("pages SEO et juridiques accessibles, robots et sitemap présents", async ({ page, request }) => {
    for (const path of ["/surveiller-prix-produit", "/alerte-retour-en-stock", "/surveiller-changements-site", "/detecter-panne-site-internet", "/surveillance-site-entreprise", "/legal/mentions-legales", "/legal/confidentialite", "/legal/cookies", "/legal/conditions-generales", "/entreprises", "/assistance", "/robot", "/fonctionnement", "/tarifs", "/telecharger"]) {
      const res = await page.goto(path);
      expect(res?.status(), path).toBe(200);
      await expect(page.getByRole("heading", { level: 1 }), path).toHaveCount(1);
    }
    expect((await request.get("/robots.txt")).status()).toBe(200);
    expect(await (await request.get("/sitemap.xml")).text()).toContain("/surveiller-prix-produit");
    await expect(page.goto("/une-page-inexistante").then((r) => r?.status())).resolves.toBe(404);
  });

  test("en-têtes de sécurité présents", async ({ request }) => {
    const res = await request.get("/");
    const h = res.headers();
    expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["x-frame-options"]).toBe("DENY");
    expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(h["x-powered-by"]).toBeUndefined();
  });

  test("accessibilité : aucune violation critique ou grave (axe)", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    for (const path of ["/", "/tarifs", "/connexion", "/inscription", "/mot-de-passe-oublie", "/lien-confirmation-invalide", "/entreprises", "/telecharger", "/fonctionnement"]) {
      await page.goto(path);
      // Fait défiler la page pour révéler toutes les sections avant l'audit.
      await page.evaluate(async () => {
        for (let y = 0; y < document.body.scrollHeight; y += 500) {
          window.scrollTo(0, y);
          await new Promise((r) => setTimeout(r, 30));
        }
      });
      await page.waitForTimeout(300);
      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
      const serious = results.violations.filter((v) => v.impact === "critical" || v.impact === "serious");
      expect(serious.map((v) => `${path}: ${v.id} (${v.nodes.length})`)).toEqual([]);
    }
  });
});

test("page « Fonctionnement de Waverti » : local expliqué hors de l'accueil, lien dans le pied de page", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Votre ordinateur d'abord, nos serveurs en relais" })).toHaveCount(0);
  await page.getByRole("contentinfo").getByRole("link", { name: "Fonctionnement de Waverti" }).click();
  await expect(page).toHaveURL(/\/fonctionnement$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Fonctionnement de Waverti");
  await expect(page.getByText("Aucun contrôle n'est exécuté sur le téléphone.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Votre ordinateur d'abord, nos serveurs en relais" })).toBeVisible();
});
