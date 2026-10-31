import { expect, test } from "@playwright/test";
import { createConfirmedUser, login, resetRateLimits, uniqueEmail } from "./helpers";

/**
 * Application installable (PWA). Vérifié ici dans Chromium (moteur d'Android/Chrome) : manifeste, service
 * worker, page hors ligne, absence de cache des données privées. L'installation réelle sur un iPhone
 * (Safari/WebKit) ou un téléphone Android n'est PAS couverte par ce test automatisé.
 */
test.describe("application installable (PWA)", () => {
  test.beforeEach(resetRateLimits);

  test("manifeste complet et icônes servies", async ({ request }) => {
    const res = await request.get("/manifest.webmanifest");
    expect(res.status()).toBe(200);
    const m = await res.json();
    expect(m).toMatchObject({ name: "Waverti", display: "standalone", scope: "/", lang: "fr" });
    expect(m.start_url).toMatch(/^\/app/);
    const sizes = m.icons.map((i: { sizes: string; purpose: string }) => `${i.sizes}:${i.purpose}`);
    expect(sizes).toEqual(expect.arrayContaining(["192x192:any", "512x512:any", "192x192:maskable", "512x512:maskable"]));
    for (const icon of m.icons) {
      const r = await request.get(icon.src);
      expect(r.status(), icon.src).toBe(200);
      expect(r.headers()["content-type"]).toContain("image/png");
    }
    const sw = await request.get("/sw.js");
    expect(sw.status()).toBe(200);
    expect(sw.headers()["cache-control"]).toContain("no-cache");
    expect(sw.headers()["service-worker-allowed"]).toBe("/");
    // iPhone : balises de l'écran d'accueil.
    const html = await (await request.get("/")).text();
    expect(html).toContain('name="mobile-web-app-capable"');
    expect(html).toContain('rel="apple-touch-icon"');
    expect(html).toContain('rel="manifest"');
  });

  test("service worker actif, page hors ligne, aucune donnée privée en cache, cache vidé à la déconnexion", async ({ page, context }) => {
    test.setTimeout(90_000);
    const u = await createConfirmedUser(uniqueEmail("pwa"));
    await login(page, u.email);
    await page.waitForURL(/\/app/);
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    // Recharge pour que la page soit contrôlée par le service worker.
    await page.reload();
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
    await page.goto("/app/surveillances");
    await page.goto("/app/parametres");
    await expect(page.getByRole("heading", { name: "Application sur téléphone" })).toBeVisible();
    await expect(page.getByTestId("pwa-install")).toBeVisible();

    const cached = await page.evaluate(async () => {
      const out: string[] = [];
      for (const k of await caches.keys()) for (const r of await (await caches.open(k)).keys()) out.push(new URL(r.url).pathname);
      return out;
    });
    expect(cached).toContain("/hors-ligne");
    expect(cached.some((p) => p.startsWith("/_next/static/"))).toBe(true);
    // Rien de personnel : ni pages de l'espace client, ni API.
    expect(cached.filter((p) => p.startsWith("/app") || p.startsWith("/api") || p.startsWith("/admin"))).toEqual([]);

    // Hors connexion : bandeau dans l'espace client, puis page dédiée à la navigation.
    await context.setOffline(true);
    await expect(page.getByRole("status").filter({ hasText: "Connexion perdue" })).toBeVisible();
    await page.goto("/app/alertes").catch(() => undefined);
    await expect(page.getByRole("heading", { name: "Vous êtes hors ligne" })).toBeVisible();
    await context.setOffline(false);
    await expect.poll(() => page.evaluate(() => navigator.onLine)).toBe(true);
    // Le retour du réseau peut prendre un instant côté service worker : nouvel essai comme le ferait l'utilisateur.
    await expect(async () => {
      await page.getByRole("button", { name: "Réessayer" }).click();
      await expect(page.getByRole("heading", { name: "Alertes" })).toBeVisible({ timeout: 3_000 });
    }).toPass({ timeout: 20_000 });
    await expect(page).toHaveURL(/\/app\/alertes/);

    // Déconnexion : en-tête Clear-Site-Data et caches vidés.
    const logout = page.waitForResponse((r) => r.url().endsWith("/auth/deconnexion"));
    await page.getByRole("button", { name: "Menu du compte" }).click();
    await page.getByRole("menuitem", { name: "Déconnexion" }).click();
    expect((await (await logout).allHeaders())["clear-site-data"]).toBe('"cache"');
    await page.waitForURL((url) => url.pathname === "/");
    // Après la déconnexion, seuls des fichiers publics (ceux de la page d'accueil) peuvent être en cache.
    const after = await page.evaluate(async () => {
      const out: string[] = [];
      for (const k of await caches.keys()) for (const r of await (await caches.open(k)).keys()) out.push(new URL(r.url).pathname);
      return out;
    });
    expect(after.filter((p) => p.startsWith("/app") || p.startsWith("/api") || p.startsWith("/admin"))).toEqual([]);
    // La commande d'effacement envoyée à la déconnexion vide bien tous les caches.
    await page.evaluate(() => navigator.serviceWorker.controller?.postMessage({ type: "waverti:clear-caches" }));
    // (la page d'accueil peut remettre aussitôt ses propres fichiers publics en cache ; la page hors ligne,
    // préchargée à l'installation et jamais visitée ici, permet de vérifier l'effacement).
    await expect
      .poll(() =>
        page.evaluate(async () => {
          for (const k of await caches.keys()) if (await (await caches.open(k)).match("/hors-ligne")) return true;
          return false;
        }),
      )
      .toBe(false);
  });
});
