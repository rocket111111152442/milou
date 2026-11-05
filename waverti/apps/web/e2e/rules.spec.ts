/**
 * Nouvelle création de surveillances : catégories, assistant, constructeur de règles, analyse de page, résumé.
 * L'analyse d'une page externe est simulée côté navigateur (aucun site tiers contacté) ; le moteur d'analyse
 * lui-même est couvert par les tests unitaires et d'intégration sur pages contrôlées.
 */
import { expect, test, type Page } from "@playwright/test";
import { CHROME_CONSENT_VERSION } from "@waverti/types";
import { createConfirmedUser, login, resetRateLimits, sql, uniqueEmail } from "./helpers";

const ORIGIN = { origin: "http://localhost:3000" };

async function openWizard(page: Page, plan: "plus" | "pro" | "business" = "pro", query = "") {
  const u = await createConfirmedUser(uniqueEmail("wiz"), { plan });
  await login(page, u.email, undefined, `/app/surveillances/nouvelle${query}`);
  await page.waitForURL(/surveillances\/nouvelle/);
  return u;
}

/** Clique « Continuer » n fois (étapes de l'assistant en 5 étapes). */
async function next(page: Page, n = 1) {
  for (let i = 0; i < n; i++) await page.getByRole("button", { name: /Continuer/ }).click();
}

test.describe("création de surveillances — nouvelle interface", () => {
  test.beforeEach(resetRateLimits);

  test("les 10 catégories sont proposées", async ({ page }) => {
    await openWizard(page);
    for (const c of ["Prix", "Produits", "Pages web", "Mots-clés", "Événements", "Entreprises", "Actualités", "Disponibilité de sites", "Documents", "Personnalisée"]) {
      await expect(page.getByRole("listitem").filter({ hasText: c }).first()).toBeVisible();
    }
  });

  test("le relevé Chrome est affiché sans vérification serveur séparée, et l’activation reste possible", async ({ page }) => {
    const { id } = await openWizard(page);
    await sql`insert into agent_devices (user_id, name, platform, token_hash, status, monitoring_enabled, consent_local_at, consent_version)
      values (${id}, 'Chrome de recette', 'chrome', ${"chrome_import_" + id}, 'active', true, now(), ${CHROME_CONSENT_VERSION})`;
    const url = "https://boutique.example.com/produit";
    const reading = { version: 2, recurring: true, url, price: 1297.99, currency: "EUR", availability: "in_stock", observedAt: new Date().toISOString() };
    await page.goto("/app");
    await page.goto("/app/surveillances/nouvelle#waverti-releve=" + encodeURIComponent(JSON.stringify(reading)));
    await expect(page.getByText("Relevé ponctuel de Chrome", { exact: true })).toBeVisible();
    await expect(page.getByText(/1\s*297,99/)).toBeVisible();
    await expect(page.getByText("Disponible", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Changer de type" }).click();
    await page.getByRole("listitem").filter({ has: page.getByText("Produits", { exact: true }) }).click();
    // Avec un relevé Chrome, le suivi automatique utilise ses propres contrôles : aucune vérification serveur séparée n'est proposée.
    await expect(page.getByRole("button", { name: "Vérifier depuis les serveurs" })).toHaveCount(0);
    await expect(page.getByText("Relevé ponctuel de Chrome", { exact: true })).toBeVisible();
    await expect(page.getByText("Disponible", { exact: true })).toBeVisible();
    await next(page, 3);
    await expect(page.getByText("Données de surveillance non confirmées")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Activer la surveillance" })).toBeEnabled();
  });

  test("assistant en langage naturel → règle ET → création", async ({ page }) => {
    await openWizard(page);
    await page.getByLabel("Décrivez-le avec vos mots").fill("Préviens-moi quand ce produit passe sous 150 € et revient en stock");
    await page.getByRole("button", { name: "Interpréter" }).click();
    await page.getByLabel(/^Adresse/).fill("https://boutique.example.com/velo");
    await next(page);
    await expect(page.getByText("Le prix est inférieur à 150 €")).toBeVisible();
    await expect(page.getByText("ET Le produit est en stock")).toBeVisible();
    await next(page, 2);
    await page.getByLabel(/^Nom de la surveillance/).fill("Vélo");
    await page.getByRole("button", { name: "Activer la surveillance" }).click();
    await page.waitForURL(/\/app\/surveillances\/[0-9a-f-]{36}$/);
    await expect(page.getByRole("list", { name: "Conditions de la règle" })).toContainText("Le prix est inférieur à 150 €");
    const id = page.url().split("/").pop()!;
    const [t] = await sql<{ c: { match: string; conditions: Array<{ type: string }> } }[]>`select condition as c from monitoring_tasks where id = ${id}`;
    expect(t!.c.match).toBe("all");
    expect(t!.c.conditions.map((c) => c.type)).toEqual(["price_below", "stock_is"]);
  });

  test("constructeur : OU, groupe, exclusion, validation des champs vides", async ({ page }) => {
    await openWizard(page, "pro", "?categorie=custom");
    await page.getByLabel(/^Adresse/).fill("https://www.exemple.fr/actualites");
    await next(page);
    await page.getByRole("button", { name: "Ajouter une condition" }).click();
    const types = page.getByLabel("Type de condition");
    await types.nth(1).selectOption("text_match");
    await next(page);
    await expect(page.getByText("Indiquez le ou les mots recherchés.").first()).toBeVisible();
    await page.getByLabel("Mots ou expressions, séparés par des virgules").fill("inscription, billetterie");
    await page.getByRole("radiogroup", { name: "Combinaison des conditions" }).getByRole("radio", { name: "Au moins une (OU)" }).click();
    await page.getByText("Exclusions et fiabilité").click();
    await page.getByLabel("Ne pas alerter si l'élément contient").fill("complet");
    await page.getByLabel(/Confirmer au contrôle suivant/).click();
    await expect(page.getByText("OU La page contient « inscription » ou « billetterie »")).toBeVisible();
    await expect(page.getByText("Sauf si « complet » figure dans l'élément concerné")).toBeVisible();
    await next(page, 2);
    await page.getByLabel(/^Nom de la surveillance/).fill("Actualités");
    await page.getByRole("button", { name: "Activer la surveillance" }).click();
    await page.waitForURL(/\/app\/surveillances\/[0-9a-f-]{36}$/);
    const id = page.url().split("/").pop()!;
    const [t] = await sql<{ c: { match: string; exclude: string[]; options: { confirm: boolean } } }[]>`select condition as c from monitoring_tasks where id = ${id}`;
    expect(t!.c).toMatchObject({ match: "any", exclude: ["complet"], options: { confirm: true } });
  });

  test("analyse de page : suggestions et sélection d'une zone (réponse simulée)", async ({ page }) => {
    await openWizard(page, "pro", "?categorie=page");
    await page.route("**/api/monitors/preview", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          observation: { title: "Agenda des concerts", price: null, currency: null, priceSource: null, availability: "unknown", availabilitySource: "none", selectorFound: null, httpStatus: 200, finalUrl: "https://salle.example.com/agenda" },
          analysis: { title: "Agenda des concerts", contentKind: "html", price: null, currency: null, regularPrice: null, availability: "unknown", items: [{ t: "Concert A" }, { t: "Concert B" }, { t: "Concert C" }], documents: [], futureDates: ["2027-02-14"], headings: ["Agenda", "Infos"], linksCount: 12, tablesCount: 1, signupForm: false, textSample: "Billetterie bientôt ouverte" },
          suggestions: [
            { id: "new-date", category: "event", title: "Nouvelle date annoncée", description: "", rule: { type: "rule", category: "event", conditions: [{ type: "date_added" }] } },
            { id: "table", category: "page", title: "Modification d'un tableau", description: "", rule: { type: "rule", category: "page", conditions: [{ type: "table_changed" }] } },
          ],
          blocks: [{ selector: "#programme", label: "Programme", sample: "14 février : Concert A", kind: "section" }],
        }),
      }),
    );
    await page.getByLabel(/^Adresse/).fill("https://salle.example.com/agenda");
    await page.getByRole("button", { name: "Vérifier la page" }).click();
    await expect(page.getByText("3+ éléments de liste · 1 date(s) à venir")).toBeVisible();
    await next(page);
    await page.getByRole("radio", { name: /Modification d'une section précise/ }).click();
    await next(page);
    await expect(page.getByRole("alert").filter({ hasText: /Choisissez la zone/ })).toBeVisible();
    await page.getByRole("radio", { name: /Programme/ }).click();
    await page.getByRole("button", { name: "Nouvelle date annoncée" }).click();
    await expect(page.getByText("Une nouvelle date à venir apparaît")).toBeVisible();
    await next(page, 2);
    await expect(page.getByText("Zone : #programme")).toBeVisible();
  });

  test("Actualités : sujet en langage naturel (moteur de recherche) ; Business verrouillé hors offre", async ({ page }) => {
    await openWizard(page, "pro", "?categorie=news");
    await page.getByRole("textbox", { name: /^Quel sujet voulez-vous suivre/ }).fill("Préviens-moi lorsque Samsung annonce officiellement un nouveau Galaxy");
    await page.getByRole("button", { name: "Analyser la demande" }).click();
    await expect(page.getByLabel("Sujet retenu")).not.toHaveValue("");
    await next(page, 3);
    await expect(page.getByText(/Recherche sur Internet : «/)).toBeVisible();
    await page.getByRole("button", { name: "Activer la surveillance" }).click();
    await page.waitForURL(/\/app\/surveillances\/[0-9a-f-]{36}$/);

    await page.goto("/app/surveillances/nouvelle?categorie=uptime");
    await page.getByLabel(/^Adresse/).fill("https://www.exemple.fr");
    await next(page);
    await page.getByRole("radio", { name: /Certificat HTTPS/ }).click();
    await expect(page.getByText("Ces contrôles ne sont pas inclus dans votre formule")).toBeVisible();
    await expect(page.getByRole("button", { name: /Continuer/ })).toBeDisabled();
  });

  test("le serveur refuse une règle impossible (sans zone) et ne contourne pas la fréquence de la formule", async ({ page }) => {
    await openWizard(page, "plus");
    const body = (condition: unknown, extra: Record<string, unknown> = {}) => ({ kind: "page", name: "x", url: "https://shop.example.com/p", condition, notify: { inapp: true, email: false, desktop: false }, ...extra });
    const noZone = await page.request.post("/api/monitors", { data: body({ type: "rule", conditions: [{ type: "element_present" }] }), headers: ORIGIN });
    expect(noZone.status()).toBe(422);
    const fast = await page.request.post("/api/monitors", { data: body({ type: "rule", conditions: [{ type: "page_changed" }] }, { intervalMinutes: 5 }), headers: ORIGIN });
    expect(fast.status()).toBeGreaterThanOrEqual(400);
    const js = await page.request.post("/api/monitors", { data: body({ type: "rule", conditions: [{ type: "script", code: "process.exit()" }] }), headers: ORIGIN });
    expect(js.status()).toBeGreaterThanOrEqual(400);
    expect(js.status()).toBeLessThan(500);
  });
});

test.describe("mobile", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  test.beforeEach(resetRateLimits);

  test("création complète au téléphone, sans défilement horizontal", async ({ page }) => {
    await openWizard(page);
    await page.getByRole("listitem").filter({ hasText: "Mots-clés" }).first().click();
    await page.getByLabel(/^Adresse/).fill("https://www.exemple.fr/concours");
    await next(page);
    await page.getByLabel("Mots ou expressions, séparés par des virgules").fill("inscriptions");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    await next(page, 2);
    await page.getByLabel(/^Nom de la surveillance/).fill("Concours");
    await page.getByRole("button", { name: "Activer la surveillance" }).click();
    await page.waitForURL(/\/app\/surveillances\/[0-9a-f-]{36}$/);
  });
});
