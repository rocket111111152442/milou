import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.describe("site public", () => {
  test("la page d'accueil présente toutes les sections sans erreur", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => m.type() === "error" && !m.text().includes("404") && errors.push(m.text()));
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Ne cherchez plus.");
    for (const name of [
      "Trois étapes, puis vous n'y pensez plus",
      "Une page, une condition, une alerte",
      "Posez votre question une fois, Watchly la repose chaque jour",
      "Votre site tombe en panne ? Vous le savez avant vos clients.",
      "Voyez Watchly décider à votre place",
      "Simple à utiliser, même quand c'est technique",
      "Votre ordinateur d'abord, nos serveurs en relais",
      "Watchly sur votre ordinateur",
      "Une formule pour chaque besoin",
      "Tout ce que vous voulez savoir",
      "Prêt à ne plus rien manquer ?",
    ]) {
      await expect(page.getByRole("heading", { name })).toBeVisible();
    }
    await expect(page.getByText("WATCHLY — Développé par")).toBeVisible();
    await expect(page.getByRole("link", { name: "LULLIN WEB" }).first()).toHaveAttribute("href", "https://www.lullin-web.com");
    expect(errors).toEqual([]);
  });

  test("aucun téléchargement actif n'est proposé sans version publiée", async ({ page }) => {
    await page.goto("/telecharger");
    await expect(page.getByText("Bientôt disponible")).toHaveCount(3);
    await expect(page.locator('a[href$=".msi"], a[href$=".dmg"], a[href$=".AppImage"], a[href$=".deb"]')).toHaveCount(0);
  });

  test("la démonstration interactive fonctionne sans appel réseau", async ({ page }) => {
    await page.goto("/#demo");
    const apiCalls: string[] = [];
    page.on("request", (r) => r.url().includes("/api/") && apiCalls.push(r.url()));
    const demo = page.locator("#demo");
    await demo.getByRole("button", { name: "Étape suivante" }).first().click();
    await demo.getByRole("button", { name: "Étape suivante" }).first().click();
    await expect(demo.getByText("Journal des contrôles")).toBeVisible();
    await demo.getByRole("tab", { name: /Panne de site pro/ }).click();
    await demo.getByRole("button", { name: "Lancer la simulation" }).click();
    await expect(demo.getByText("Service rétabli")).toBeVisible({ timeout: 15_000 });
    expect(apiCalls).toEqual([]);
  });

  test("tarifs : 4 formules et comparatif", async ({ page }) => {
    await page.goto("/tarifs");
    for (const price of ["0 €", "5,99 €", "14,99 €", "39,99 €"]) await expect(page.getByText(price, { exact: false }).first()).toBeVisible();
    await expect(page.getByRole("table", { name: /Comparatif/ })).toBeVisible();
  });

  test("pages SEO et juridiques accessibles, robots et sitemap présents", async ({ page, request }) => {
    for (const path of ["/surveiller-prix-produit", "/alerte-retour-en-stock", "/surveiller-changements-site", "/detecter-panne-site-internet", "/surveillance-site-entreprise", "/legal/mentions-legales", "/legal/confidentialite", "/legal/cookies", "/legal/conditions-generales", "/entreprises", "/assistance", "/robot", "/tarifs", "/telecharger"]) {
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
    for (const path of ["/", "/tarifs", "/connexion", "/inscription", "/entreprises", "/telecharger"]) {
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
