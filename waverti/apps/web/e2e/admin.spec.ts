import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { createConfirmedUser, DB_URL, enableMfa, login, resetRateLimits, sql, uniqueEmail } from "./helpers";

const ROOT = join(import.meta.dirname, "../../..");

function grantAdmin(email: string) {
  execFileSync("pnpm", ["-s", "admin:grant", email], { cwd: ROOT, env: { ...process.env, DATABASE_URL: DB_URL }, stdio: "pipe" });
}

test.describe("administration LULLIN WEB", () => {
  test.beforeEach(resetRateLimits);

  test("rôle administrateur donné en ligne de commande uniquement ; API invisible pour les autres", async ({ page }) => {
    const user = await createConfirmedUser(uniqueEmail("std"));
    await login(page, user.email);
    await page.waitForURL(/\/app/);
    const headers = { origin: "http://localhost:3000" };
    expect((await page.request.post(`/api/admin/users/${user.id}/suspension`, { data: { suspended: true, reason: "tentative" }, headers })).status()).toBe(404);
    // Un utilisateur ne peut pas s'attribuer le rôle via son profil.
    const patch = await page.request.patch("/api/account/profile", { data: { role: "admin" }, headers });
    expect(patch.status()).toBe(400);
    const [p] = await sql<{ role: string }[]>`select role from profiles where id = ${user.id}`;
    expect(p!.role).toBe("user");
  });

  test("indicateurs, suspension motivée et journal d'audit, assistance", async ({ page, browser }) => {
    const admin = await createConfirmedUser(uniqueEmail("admin"));
    grantAdmin(admin.email);
    const target = await createConfirmedUser(uniqueEmail("cible"), { plan: "pro" });
    const [ticket] = await sql<{ id: string }[]>`
      insert into support_tickets (user_id, email, subject, category) values (${target.id}, ${target.email}, 'Question sur une alerte', 'monitoring') returning id`;
    await sql`insert into support_messages (ticket_id, user_id, author, body) values (${ticket!.id}, ${target.id}, 'user', 'Bonjour, je ne reçois pas mes alertes.')`;

    // ADMIN_REQUIRE_MFA=1 (configuration de production) : double authentification obligatoire avant l'administration.
    await login(page, admin.email, undefined, "/admin");
    await page.waitForURL(/\/app\/parametres\?double-authentification=requise/);
    const early = await page.request.post(`/api/admin/users/${target.id}/suspension`, { data: { suspended: true, reason: "abc" }, headers: { origin: "http://localhost:3000" } });
    expect(early.status()).toBe(404);
    await expect(page.getByText(/obligatoire pour accéder à l'administration/)).toBeVisible();
    await enableMfa(page);
    await page.goto("/admin");
    await page.waitForURL(/\/admin$/);
    await expect(page.getByRole("heading", { name: "Vue d'ensemble" })).toBeVisible();
    await expect(page.getByText("Revenu mensuel récurrent")).toBeVisible();
    await expect(page.getByText(/MODE TEST, aucun encaissement réel/)).toBeVisible();
    await expect(page.getByRole("heading", { name: "Points d'attention" })).toBeVisible();

    // Erreurs des boucles du worker : seules celles de la dernière heure sont signalées.
    const workerId = `e2e-worker-${Date.now()}`;
    const now = new Date();
    const old = new Date(now.getTime() - 2 * 3_600_000);
    const stats = {
      loops: {
        "business:uptime": { runs: 10, errors: 3, lastError: "connexion refusée (e2e)", lastErrorAt: now.toISOString() },
        "business:tls": { runs: 4, errors: 1, lastError: "erreur ancienne (e2e)", lastErrorAt: old.toISOString() },
      },
    };
    await sql`insert into worker_heartbeats (worker_id, hostname, role, started_at, last_seen_at, stats)
      values (${workerId}, 'e2e-host', 'all', now(), now(), ${sql.json(stats)})`;
    try {
      await page.reload();
      await expect(page.getByText("business:uptime : 3 erreur(s) (connexion refusée (e2e))")).toBeVisible();
      await expect(page.getByText("Erreurs dans les traitements du worker")).toBeVisible();
      await expect(page.getByText(/erreur ancienne \(e2e\)/)).toHaveCount(0);
    } finally {
      await sql`delete from worker_heartbeats where worker_id = ${workerId}`;
    }

    // Recherche puis suspension avec motif obligatoire.
    await page.getByRole("link", { name: "Utilisateurs" }).click();
    await page.getByRole("searchbox", { name: "Rechercher un utilisateur" }).fill(target.email);
    await page.getByRole("button", { name: "Rechercher" }).click();
    await page.getByRole("link", { name: target.email }).click();
    await expect(page.getByText("pro · active")).toBeVisible();
    // Motif trop court : bloqué par le formulaire, et refusé par le serveur si le formulaire est contourné.
    const short = await page.request.post(`/api/admin/users/${target.id}/suspension`, { data: { suspended: true, reason: "abc" }, headers: { origin: "http://localhost:3000" } });
    expect(short.status()).toBe(422);
    expect(JSON.stringify(await short.json())).toContain("Motif obligatoire (5 caractères minimum).");
    const reason = `Usage abusif constaté (test E2E ${Date.now()})`;
    await page.getByLabel(/Motif de la suspension/).fill(reason);
    await page.getByRole("button", { name: "Suspendre le compte" }).click();
    await expect(page.getByText(`Motif de suspension : ${reason}`)).toBeVisible();

    // Le compte suspendu n'accède plus à son espace.
    const ctx = await browser.newContext();
    const other = await ctx.newPage();
    await login(other, target.email);
    await expect(other).toHaveURL(/compte-suspendu/, { timeout: 15_000 });
    await expect(other.getByRole("heading", { name: "Compte suspendu" })).toBeVisible();
    // L'API refuse aussi ce compte.
    expect((await other.request.get("/api/monitors")).status()).toBe(401);
    await ctx.close();

    await page.getByRole("link", { name: "Journal d'audit" }).click();
    await expect(page.getByRole("cell", { name: "user.suspend" }).first()).toBeVisible();
    await expect(page.getByRole("cell", { name: reason })).toBeVisible();
    await expect(page.getByRole("cell", { name: "user.grant_admin" }).first()).toBeVisible();

    // Réponse à une demande d'assistance : message enregistré et e-mail mis en file d'envoi.
    await page.goto(`/admin/support/${ticket!.id}`);
    await expect(page.getByText("Bonjour, je ne reçois pas mes alertes.")).toBeVisible();
    await page.getByLabel(/Réponse/).fill("Bonjour,\n\nVérifiez vos préférences de notification.");
    await page.getByRole("button", { name: "Envoyer la réponse" }).click();
    await expect(page.getByText("Équipe Waverti").first()).toBeVisible();
    const [mail] = await sql<{ template: string; to_email: string }[]>`
      select template, to_email from email_outbox where idempotency_key like 'support_reply:%' and to_email = ${target.email}`;
    expect(mail).toEqual({ template: "support_reply", to_email: target.email });
  });
});
