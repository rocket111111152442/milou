/**
 * Test de bout en bout de la VRAIE application desktop (binaire Tauri, WebKitGTK) pilotée par
 * WebDriver (tauri-driver), contre le vrai serveur web local et la base Supabase locale.
 *
 * Parcours : liaison par code (validé dans un navigateur connecté) -> accord explicite ->
 * contrôle d'une page exécuté par l'ordinateur -> alerte -> pause -> déliaison.
 *
 * Prérequis (voir TESTING.md) : `supabase start`, application web sur http://localhost:3000,
 * binaire construit avec `pnpm tauri build --debug --no-bundle`, `tauri-driver`, Xvfb.
 * Lancement : DESKTOP_E2E=1 pnpm --filter @watchly/desktop test:e2e
 */
import { spawn, type ChildProcess } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import http from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { remote } from "webdriverio";
import { chromium, type Browser } from "playwright";
import postgres from "postgres";
import { createDb } from "@watchly/database";
import { createMonitor, scheduleDueTasks } from "@watchly/monitoring";

const RUN = process.env.DESKTOP_E2E === "1";
const WEB = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const DB_URL = process.env.E2E_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const SUPABASE_URL = process.env.E2E_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const APP = join(import.meta.dirname, "../src-tauri/target/debug/watchly-desktop");
const PASSWORD = "MotDePasse-E2E-2026";

let shopPrice = "129,99";
function shopHandler(req: http.IncomingMessage, res: http.ServerResponse) {
  if (req.url === "/robots.txt") {
    res.writeHead(200, { "content-type": "text/plain" }).end("User-agent: *\nDisallow: /prive/\n");
    return;
  }
  if (req.url === "/casque") {
    res
      .writeHead(200, { "content-type": "text/html; charset=utf-8" })
      .end(`<!doctype html><title>Casque Test</title><h1>Casque Test</h1><p class="prix">${shopPrice} €</p><p>En stock</p>`);
    return;
  }
  res.writeHead(404).end();
}

async function stopProcess(p: ChildProcess | undefined): Promise<void> {
  if (!p || p.exitCode !== null || p.signalCode !== null) return;
  const exited = new Promise<void>((resolve) => p.once("exit", () => resolve()));
  p.kill();
  await Promise.race([exited, new Promise((r) => setTimeout(r, 5_000))]);
}

describe.skipIf(!RUN)("application desktop réelle (Tauri + WebDriver)", () => {
  const sql = postgres(DB_URL, { max: 2, onnotice: () => undefined });
  const { db, close: closeDb } = createDb(DB_URL, { max: 2 });
  let shop: http.Server;
  let shopPort = 0;
  let xvfb: ChildProcess;
  let driver: ChildProcess;
  let home: string;
  let browser: Browser;
  let app: WebdriverIO.Browser;
  let userId = "";
  const email = `desktop.${Date.now().toString(36)}@example.test`;

  beforeAll(async () => {
    shop = http.createServer(shopHandler);
    await new Promise<void>((r) => shop.listen(0, "127.0.0.1", r));
    shopPort = (shop.address() as { port: number }).port;

    // Compte de test confirmé, créé via l'API d'administration de Supabase (locale).
    const created = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
      method: "POST",
      headers: { apikey: SERVICE_KEY, authorization: `Bearer ${SERVICE_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({ email, password: PASSWORD, email_confirm: true, user_metadata: { display_name: "Desk" } }),
    });
    expect(created.status, await created.clone().text()).toBe(200);
    userId = ((await created.json()) as { id: string }).id;
    await sql`update profiles set onboarding_completed_at = now() where id = ${userId}`;
    await sql`delete from rate_limits`;

    home = mkdtempSync(join(tmpdir(), "watchly-desktop-e2e-"));
    const display = ":97";
    xvfb = spawn("Xvfb", [display, "-screen", "0", "1280x900x24"], { stdio: "ignore" });
    await new Promise((r) => setTimeout(r, 800));
    driver = spawn("tauri-driver", ["--port", "4444"], {
      stdio: ["ignore", "inherit", "inherit"],
      env: {
        ...process.env,
        DISPLAY: display,
        HOME: home,
        XDG_DATA_HOME: join(home, "data"),
        XDG_CONFIG_HOME: join(home, "config"),
        WATCHLY_API_URL: WEB,
        WATCHLY_DEV_ALLOW_LOCAL: "1",
        NO_AT_BRIDGE: "1",
      },
    });
    await new Promise((r) => setTimeout(r, 1500));
    app = await remote({
      hostname: "127.0.0.1",
      port: 4444,
      logLevel: "warn",
      // WebKitWebDriver ne gère que le protocole WebDriver « classique » (pas BiDi).
      capabilities: { "wdio:enforceWebDriverClassic": true, "tauri:options": { application: APP } } as WebdriverIO.Capabilities,
    });
    browser = await chromium.launch();
  }, 120_000);

  afterAll(async () => {
    await app?.deleteSession().catch(() => undefined);
    // Attend la fin réelle des processus : l'application écrit encore dans HOME (cache Mesa) en se fermant.
    await Promise.all([driver, xvfb].map((p) => stopProcess(p)));
    await browser?.close();
    shop?.close();
    if (userId) {
      await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
        method: "DELETE",
        headers: { apikey: SERVICE_KEY, authorization: `Bearer ${SERVICE_KEY}` },
      });
    }
    await sql.end();
    await closeDb();
    if (home) rmSync(home, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  });

  const text = async () => (await app.$("body")).getText();
  /** Captures facultatives (E2E_SCREENSHOTS=<dossier>) pour la revue visuelle. */
  const shot = async (name: string) => {
    const dir = process.env.E2E_SCREENSHOTS;
    if (!dir) return;
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, `${name}.png`), Buffer.from(await app.takeScreenshot(), "base64"));
  };

  it("liaison par code validé dans le navigateur, sans mot de passe dans l'application", async () => {
    const start = await app.$("button*=Relier cet ordinateur");
    await start.waitForDisplayed({ timeout: 30_000 });
    await start.click();
    const codeEl = await app.$("p.font-mono");
    await codeEl.waitForDisplayed({ timeout: 15_000 });
    const userCode = (await codeEl.getText()).trim();
    await shot("1-liaison-code");
    expect(userCode).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/);

    const page = await browser.newPage();
    await page.goto(`${WEB}/connexion?suivant=${encodeURIComponent(`/app/appareils/lier?code=${userCode}`)}`);
    await page.getByLabel("Adresse e-mail").fill(email);
    await page.getByLabel(/^Mot de passe/).fill(PASSWORD);
    await page.getByRole("button", { name: "Se connecter" }).click();
    await page.waitForURL(/appareils\/lier/);
    await page.getByRole("button", { name: "Autoriser cet appareil" }).click();
    await page.getByText(/autorisé|relié/i).first().waitFor({ timeout: 10_000 });
    await page.close();

    // L'application interroge toutes les 5 s et passe à l'écran d'accord.
    const consentTitle = await app.$("h1*=Fonctionnement sur cet ordinateur");
    await consentTitle.waitForDisplayed({ timeout: 30_000 });
    const [device] = await sql<{ status: string; monitoring_enabled: boolean }[]>`select status, monitoring_enabled from agent_devices where user_id = ${userId}`;
    expect(device).toEqual({ status: "active", monitoring_enabled: false });
  }, 120_000);

  it("l'accord est obligatoire et horodaté côté serveur", async () => {
    const accept = await app.$("button*=Accepter et activer");
    expect(await accept.isEnabled()).toBe(false);
    await shot("2-accord");
    expect(await text()).toContain("Seules VOS surveillances sont contrôlées ici");
    await (await app.$("#consent")).click();
    expect(await accept.isEnabled()).toBe(true);
    await accept.click();
    await (await app.$("h1*=Vue d'ensemble")).waitForDisplayed({ timeout: 20_000 });
    const [device] = await sql<{ consent_version: string; monitoring_enabled: boolean; consent_local_at: Date | null }[]>`
      select consent_version, monitoring_enabled, consent_local_at from agent_devices where user_id = ${userId}`;
    expect(device!.monitoring_enabled).toBe(true);
    expect(device!.consent_local_at).not.toBeNull();
    expect(device!.consent_version).toBe("2026-10-29");
  }, 60_000);

  it("contrôle exécuté par l'ordinateur, résultat et alerte remontés au serveur", async () => {
    // Formule Découverte : uniquement en local. Cible locale autorisée pour ce test seulement.
    const created = await createMonitor(
      db,
      userId,
      {
        kind: "page",
        name: "Casque local",
        url: `http://127.0.0.1:${shopPort}/casque`,
        renderMode: "auto",
        condition: { type: "price_below", threshold: 130 },
        executionMode: "auto",
        notify: { inapp: true, email: false, desktop: true },
      },
      new Date(),
      { allowLoopback: true, allowAnyPort: true },
    );
    // Laisse le signal de vie arriver avant la planification (l'ordinateur doit être « en ligne »).
    await new Promise((r) => setTimeout(r, 2_000));
    await scheduleDueTasks(db, { now: new Date(Date.now() + 1000) });

    let row: { executed_by: string; outcome: string; observation: { price: number } } | undefined;
    for (let i = 0; i < 45 && !row; i++) {
      [row] = await sql`select executed_by, outcome, observation from monitoring_results where task_id = ${created.id}`;
      if (!row) await new Promise((r) => setTimeout(r, 1000));
    }
    expect(row, "aucun résultat reçu de l'application").toBeDefined();
    expect(row!.executed_by).toBe("agent");
    expect(row!.observation.price).toBe(129.99);
    expect(row!.outcome).toBe("triggered");

    // La notification est remise au bureau (statut « delivered ») et visible dans l'onglet Activité.
    let desktopStatus = "pending";
    for (let i = 0; i < 30 && desktopStatus !== "delivered"; i++) {
      const [n] = await sql<{ desktop_status: string }[]>`select desktop_status from notifications where user_id = ${userId} and task_id = ${created.id}`;
      desktopStatus = n?.desktop_status ?? "pending";
      if (desktopStatus !== "delivered") await new Promise((r) => setTimeout(r, 1000));
    }
    expect(desktopStatus).toBe("delivered");
    await (await app.$("a*=Activité de cet ordinateur")).click();
    await (await app.$("span*=Casque local")).waitForDisplayed({ timeout: 10_000 });
    expect(await text()).toContain("127.0.0.1");
    await shot("4-activite");
    expect(await (await app.$("a*=Activité de cet ordinateur")).getAttribute("aria-current")).toBe("page");
    expect(await (await app.$("a*=Vue d'ensemble")).getAttribute("aria-current")).toBeNull();
    await (await app.$("a*=Vue d'ensemble")).click();
    await (await app.$("h1*=Vue d'ensemble")).waitForDisplayed({ timeout: 10_000 });
    await new Promise((r) => setTimeout(r, 1500));
    await shot("3-vue-ensemble");
    await (await app.$("a*=Mes surveillances")).click();
    await (await app.$("a*=Casque local")).waitForDisplayed({ timeout: 10_000 });
    await (await app.$("a*=Casque local")).click();
    await (await app.$("h2*=Historique des contrôles")).waitForDisplayed({ timeout: 10_000 });
    await new Promise((r) => setTimeout(r, 800));
    await shot("5-detail");
    // Historique global : même résultat, avec le nom de la surveillance, servi par /api/history.
    await (await app.$("a*=Historique")).click();
    await (await app.$("h1*=Historique")).waitForDisplayed({ timeout: 10_000 });
    await (await app.$("p*=Casque local —")).waitForDisplayed({ timeout: 10_000 });
    expect(await (await app.$("a*=Historique")).getAttribute("aria-current")).toBe("page");
    expect(await (await app.$("a*=Mes surveillances")).getAttribute("aria-current")).toBeNull();
    await shot("6-historique");
  }, 120_000);

  it("pause depuis l'interface : l'état est transmis au serveur", async () => {
    await (await app.$("button*=Pause")).click();
    let state: string | null = null;
    for (let i = 0; i < 40 && state !== "paused"; i++) {
      const [d] = await sql<{ last_state: string | null }[]>`select last_state from agent_devices where user_id = ${userId}`;
      state = d?.last_state ?? null;
      if (state !== "paused") await new Promise((r) => setTimeout(r, 1000));
    }
    expect(state).toBe("paused");
    await (await app.$("button*=Reprendre")).click();
  }, 60_000);

  it("déliaison : jeton révoqué côté serveur et retour à l'écran de liaison", async () => {
    await (await app.$("a*=Paramètres")).click();
    await (await app.$("button=Délier")).click();
    const confirm = await app.$$("button=Délier");
    await confirm[confirm.length - 1]!.click();
    await (await app.$("button*=Relier cet ordinateur")).waitForDisplayed({ timeout: 15_000 });
    const [device] = await sql<{ status: string }[]>`select status from agent_devices where user_id = ${userId}`;
    expect(device!.status).toBe("revoked");
  }, 60_000);
});
