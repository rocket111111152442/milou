"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { checkPassword, consumeToken, createAccount, findUserByEmail, issueToken, setPassword, verifySecondFactor } from "@waverti/auth";
import { PAID_PLAN_IDS } from "@waverti/billing/catalog";
import { eq, users } from "@waverti/database";
import { mfaChallengePath } from "@/lib/auth";
import { sendAuthEmail } from "@/lib/auth-email";
import { getDb } from "@/lib/db";
import { appUrl, clientIp, ipKey, safeNext } from "@/lib/request";
import { rateLimit } from "@/lib/rate-limit";
import { elevateCurrentSession, encryptionKey, getActiveSession, hashPepper, isAuthConfigured, startSession } from "@/lib/session";

export interface FormState {
  error?: string | null;
  fieldErrors?: Record<string, string>;
  message?: string | null;
  values?: Record<string, string>;
}

const COMMON_PASSWORDS = new Set(["motdepasse1", "password123", "azertyuiop", "1234567890", "qwertyuiop", "waverti2026", "motdepasse"]);

const passwordSchema = z
  .string()
  .min(10, "10 caractères minimum")
  .max(128, "128 caractères maximum")
  .refine((p) => !COMMON_PASSWORDS.has(p.toLowerCase()), "Mot de passe trop courant")
  .refine((p) => /[a-zA-Z]/.test(p) && /[0-9\W_]/.test(p), "Mélangez lettres et chiffres ou symboles");

const NOT_CONFIGURED: FormState = {
  error: "L'authentification n'est pas encore configurée sur cet environnement (base de données). Aucune donnée n'a été envoyée.",
};

function fieldErrors(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of err.issues) out[String(i.path[0])] ??= i.message;
  return out;
}

function confirmUrl(token: string, next: string): string {
  return `${appUrl()}/auth/confirm?token=${encodeURIComponent(token)}&next=${encodeURIComponent(next)}`;
}

export async function signUpAction(_: FormState, form: FormData): Promise<FormState> {
  if (!isAuthConfigured()) return NOT_CONFIGURED;
  const values = { email: String(form.get("email") ?? ""), displayName: String(form.get("displayName") ?? "") };
  const parsed = z
    .object({
      email: z.string().trim().toLowerCase().email("Adresse e-mail invalide").max(254),
      password: passwordSchema,
      displayName: z.string().trim().max(80).optional(),
      terms: z.literal("on", { message: "Vous devez accepter les conditions pour créer un compte" }),
      formule: z.enum(PAID_PLAN_IDS).optional().or(z.literal("")),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values };

  const ip = ipKey(await clientIp());
  const rl = await rateLimit(`signup:${ip}`, 5, 3600);
  if (!rl.ok) return { error: "Trop d'inscriptions depuis cette connexion. Réessayez dans une heure.", values };

  // Pas de formule gratuite : sans formule choisie, l'utilisateur arrive sur le choix d'abonnement (essai de 3 jours).
  const next = parsed.data.formule ? `/app/abonnement/essai?formule=${parsed.data.formule}` : "/app/abonnement?bienvenue=1";
  const db = getDb();
  const created = await createAccount(db, { email: parsed.data.email, password: parsed.data.password, displayName: parsed.data.displayName || null });
  if (created) {
    const token = await issueToken(db, created.userId, "verify_email");
    await sendAuthEmail(db, { userId: created.userId, to: parsed.data.email, template: "verify_email", url: confirmUrl(token, next) });
  }
  // Réponse identique si l'adresse a déjà un compte (pas d'énumération des comptes).
  redirect(`/verifier-email?email=${encodeURIComponent(parsed.data.email)}`);
}

export async function signInAction(_: FormState, form: FormData): Promise<FormState> {
  if (!isAuthConfigured()) return NOT_CONFIGURED;
  const values = { email: String(form.get("email") ?? "") };
  const parsed = z
    .object({ email: z.string().trim().toLowerCase().email("Adresse e-mail invalide"), password: z.string().min(1, "Mot de passe requis").max(128) })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values };

  const ip = ipKey(await clientIp());
  const [byIp, byAccount] = await Promise.all([
    rateLimit(`login:ip:${ip}`, 20, 900),
    rateLimit(`login:acct:${ipKey(parsed.data.email)}`, 10, 900),
  ]);
  if (!byIp.ok || !byAccount.ok) return { error: "Trop de tentatives de connexion. Réessayez dans 15 minutes.", values };

  const check = await checkPassword(getDb(), parsed.data.email, parsed.data.password);
  if (!check.ok) {
    if (check.reason === "unverified") return { error: "Votre adresse e-mail n'est pas encore vérifiée. Consultez l'e-mail de confirmation.", values };
    return { error: "Adresse e-mail ou mot de passe incorrect.", values };
  }
  await startSession(check.user.id, 1);
  const next = safeNext(String(form.get("suivant") ?? ""), "/app");
  if (check.user.totpEnabledAt) redirect(mfaChallengePath(next));
  redirect(next);
}

/** Deuxième étape de connexion : code de l'application d'authentification ou code de récupération. */
export async function mfaChallengeAction(_: FormState, form: FormData): Promise<FormState> {
  if (!isAuthConfigured()) return NOT_CONFIGURED;
  const next = safeNext(String(form.get("suivant") ?? ""), "/app");
  const code = String(form.get("code") ?? "").trim();
  if (!/^\d{3}\s?\d{3}$/.test(code) && !/^[A-Za-z2-7]{5}-?[A-Za-z2-7]{5}$/.test(code)) {
    return { fieldErrors: { code: "Saisissez les 6 chiffres de votre application ou un code de récupération" } };
  }
  const session = await getActiveSession();
  if (!session) redirect("/connexion?erreur=session");
  if (!session.user.totpEnabledAt) redirect(next);
  const rl = await rateLimit(`mfa:${session.userId}`, 10, 900);
  if (!rl.ok) return { error: "Trop de codes saisis. Réessayez dans 15 minutes." };
  const method = await verifySecondFactor(getDb(), session.userId, code, encryptionKey(), hashPepper());
  if (!method) return { fieldErrors: { code: "Code incorrect ou expiré. Saisissez le code affiché actuellement." } };
  await elevateCurrentSession(session);
  redirect(method === "recovery" ? "/app/parametres?code-recuperation=utilise#double-authentification" : next);
}

export async function forgotPasswordAction(_: FormState, form: FormData): Promise<FormState> {
  if (!isAuthConfigured()) return NOT_CONFIGURED;
  const parsed = z.object({ email: z.string().trim().toLowerCase().email("Adresse e-mail invalide") }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  const ip = ipKey(await clientIp());
  const [byIp, byAccount] = await Promise.all([rateLimit(`reset:${ip}`, 5, 3600), rateLimit(`reset:acct:${ipKey(parsed.data.email)}`, 3, 3600)]);
  if (byIp.ok && byAccount.ok) {
    const db = getDb();
    const user = await findUserByEmail(db, parsed.data.email);
    if (user?.emailVerifiedAt) {
      const token = await issueToken(db, user.id, "reset_password");
      await sendAuthEmail(db, {
        userId: user.id,
        to: user.email,
        template: "reset_password",
        url: `${appUrl()}/reinitialiser-mot-de-passe?token=${encodeURIComponent(token)}`,
      });
    }
  }
  // Réponse identique dans tous les cas (pas d'énumération des comptes).
  return { message: "Si un compte existe pour cette adresse, un e-mail de réinitialisation vient d'être envoyé." };
}

export async function resetPasswordAction(_: FormState, form: FormData): Promise<FormState> {
  if (!isAuthConfigured()) return NOT_CONFIGURED;
  const parsed = z
    .object({ password: passwordSchema, confirm: z.string(), token: z.string().min(20).max(100) })
    .refine((v) => v.password === v.confirm, { message: "Les mots de passe ne correspondent pas", path: ["confirm"] })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  const db = getDb();
  const userId = await consumeToken(db, parsed.data.token, "reset_password");
  if (!userId) return { error: "Le lien de réinitialisation a expiré ou a déjà été utilisé. Demandez-en un nouveau." };
  // Toutes les sessions existantes sont fermées ; la double authentification reste exigée.
  await setPassword(db, userId, parsed.data.password);
  await startSession(userId, 1);
  const [u] = await db.select({ totp: users.totpEnabledAt }).from(users).where(eq(users.id, userId)).limit(1);
  if (u?.totp) redirect(mfaChallengePath("/app?mot-de-passe=modifie"));
  redirect("/app?mot-de-passe=modifie");
}

export async function resendConfirmationAction(_: FormState, form: FormData): Promise<FormState> {
  if (!isAuthConfigured()) return NOT_CONFIGURED;
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  if (!z.string().email().safeParse(email).success) return { error: "Adresse e-mail invalide." };
  const rl = await rateLimit(`resend:${ipKey(email)}`, 3, 3600);
  if (rl.ok) {
    const db = getDb();
    const user = await findUserByEmail(db, email);
    if (user && !user.emailVerifiedAt) {
      const token = await issueToken(db, user.id, "verify_email");
      await sendAuthEmail(db, { userId: user.id, to: user.email, template: "verify_email", url: confirmUrl(token, "/app/abonnement?bienvenue=1") });
    }
  }
  return { message: "Si l'adresse doit encore être vérifiée, un nouvel e-mail a été envoyé." };
}
