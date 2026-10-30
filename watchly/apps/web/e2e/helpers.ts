import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, type Page } from "@playwright/test";
import postgres from "postgres";

export const MAILPIT = process.env.E2E_MAILPIT_URL ?? "http://127.0.0.1:54324";
export const DB_URL = process.env.E2E_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
export const sql = postgres(DB_URL, { max: 2, onnotice: () => undefined });

export const PASSWORD = "MotDePasse-E2E-2026";

export function uniqueEmail(prefix = "e2e"): string {
  return `${prefix}.${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}@example.test`;
}

interface MailSummary {
  ID: string;
  Subject: string;
  To: Array<{ Address: string }>;
}

/** Attend l'e-mail envoyé par l'authentification Supabase (Mailpit) et renvoie le premier lien d'action. */
export async function waitForEmailLink(to: string, subjectIncludes: string, timeoutMs = 20_000): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`);
    const list = (await res.json()) as { messages: MailSummary[] };
    const msg = list.messages?.find((m) => m.Subject.includes(subjectIncludes));
    if (msg) {
      const full = (await (await fetch(`${MAILPIT}/api/v1/message/${msg.ID}`)).json()) as { HTML: string };
      const href = /href="([^"]+token_hash[^"]+)"/.exec(full.HTML)?.[1];
      if (href) return href.replace(/&amp;/g, "&");
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Aucun e-mail « ${subjectIncludes} » reçu pour ${to}`);
}

export async function signUpAndConfirm(page: Page, email = uniqueEmail(), formule?: string): Promise<string> {
  await page.goto(formule ? `/inscription?formule=${formule}` : "/inscription");
  await page.getByLabel("Prénom ou pseudo").fill("Camille");
  await page.getByLabel("Adresse e-mail").fill(email);
  await page.getByLabel(/^Mot de passe/).fill(PASSWORD);
  await page.getByRole("checkbox", { name: /conditions générales/ }).check();
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await expect(page).toHaveURL(/verifier-email/);
  const link = await waitForEmailLink(email, "Confirmez");
  await page.goto(link);
  return email;
}

export async function login(page: Page, email: string, password = PASSWORD, next?: string) {
  await page.goto(next ? `/connexion?suivant=${encodeURIComponent(next)}` : "/connexion");
  await page.getByLabel("Adresse e-mail").fill(email);
  await page.getByLabel(/^Mot de passe/).fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();
}

export async function userIdByEmail(email: string): Promise<string> {
  const [row] = await sql<{ id: string }[]>`select id from profiles where email = ${email}`;
  return row!.id;
}

/** Base locale uniquement : remet à zéro les limites de débit (les tests créent beaucoup de comptes depuis la même IP). */
export async function resetRateLimits() {
  await sql`delete from rate_limits`;
}

/** Marque l'onboarding comme fait pour aller directement au tableau de bord. */
export async function skipOnboarding(email: string) {
  await sql`update profiles set onboarding_completed_at = now() where email = ${email}`;
}

const SUPABASE_URL = process.env.E2E_SUPABASE_URL ?? "http://127.0.0.1:54321";

function serviceRoleKey(): string {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) return process.env.SUPABASE_SERVICE_ROLE_KEY;
  const env = readFileSync(join(import.meta.dirname, "../.env.local"), "utf8");
  return /^SUPABASE_SERVICE_ROLE_KEY=(.+)$/m.exec(env)?.[1]?.trim() ?? "";
}

/** Compte confirmé créé via l'API d'administration de Supabase locale (plus rapide que l'inscription). */
/**
 * Compte confirmé. Par défaut abonné Plus actif (il n'existe pas de formule gratuite) ;
 * `plan: null` pour un compte sans abonnement, `status: "trialing"` pour un essai en cours.
 */
export async function createConfirmedUser(
  email = uniqueEmail(),
  opts: { plan?: "plus" | "pro" | "max" | "business" | null; status?: "active" | "trialing" } = {},
): Promise<{ id: string; email: string }> {
  const plan = opts.plan === undefined ? "plus" : opts.plan;
  const key = serviceRoleKey();
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: { apikey: key, authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ email, password: PASSWORD, email_confirm: true, user_metadata: { display_name: "Test" } }),
  });
  if (!res.ok) throw new Error(`création du compte impossible : ${res.status} ${await res.text()}`);
  const { id } = (await res.json()) as { id: string };
  await sql`update profiles set onboarding_completed_at = now() where id = ${id}`;
  if (plan) {
    // Équivaut au résultat d'un webhook Stripe « abonnement actif » ou « essai démarré » (mode test).
    if (opts.status === "trialing") {
      await sql`insert into subscriptions (user_id, plan_id, stripe_subscription_id, stripe_customer_id, status, trial_start, trial_end, current_period_end)
                values (${id}, ${plan}, ${"sub_e2e_" + id}, ${"cus_e2e_" + id}, 'trialing', now(), now() + interval '72 hours', now() + interval '72 hours')`;
    } else {
      await sql`insert into subscriptions (user_id, plan_id, stripe_subscription_id, stripe_customer_id, status, current_period_end)
                values (${id}, ${plan}, ${"sub_e2e_" + id}, ${"cus_e2e_" + id}, 'active', now() + interval '20 days')`;
    }
  }
  await sql`delete from entitlements where user_id = ${id}`;
  return { id, email };
}

/** Code TOTP (RFC 6238 : HMAC-SHA1, 30 s, 6 chiffres), comme une application d'authentification. */
export function totp(secret: string, at = Date.now()): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const bits = [...secret.replace(/=+$/, "").toUpperCase()].map((c) => alphabet.indexOf(c).toString(2).padStart(5, "0")).join("");
  const key = Buffer.from(bits.match(/.{8}/g)!.map((b) => parseInt(b, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(at / 30_000)));
  const h = createHmac("sha1", key).update(counter).digest();
  const o = h[h.length - 1]! & 0xf;
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000).padStart(6, "0");
}

/** Active la double authentification depuis la page Paramètres ; renvoie la clé TOTP. */
export async function enableMfa(page: Page): Promise<string> {
  if (!page.url().includes("/app/parametres")) await page.goto("/app/parametres");
  await page.getByRole("button", { name: "Activer la double authentification" }).click();
  await expect(page.getByRole("img", { name: /QR code de configuration/ })).toBeVisible();
  const secret = (await page.getByTestId("mfa-secret").innerText()).trim();
  await page.getByLabel(/^Code à 6 chiffres/).fill(totp(secret));
  await page.getByRole("button", { name: "Confirmer l'activation" }).click();
  await expect(page.getByText("Double authentification activée", { exact: true })).toBeVisible();
  return secret;
}
