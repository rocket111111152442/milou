"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { PAID_PLAN_IDS } from "@watchly/billing/catalog";
import { mfaChallengePath } from "@/lib/auth";
import { appUrl, clientIp, ipKey, safeNext } from "@/lib/request";
import { rateLimit } from "@/lib/rate-limit";
import { createSupabaseServerClient, isAuthConfigured } from "@/lib/supabase/server";

export interface FormState {
  error?: string | null;
  fieldErrors?: Record<string, string>;
  message?: string | null;
  values?: Record<string, string>;
}

const COMMON_PASSWORDS = new Set(["motdepasse1", "password123", "azertyuiop", "1234567890", "qwertyuiop", "watchly2026", "motdepasse"]);

const passwordSchema = z
  .string()
  .min(10, "10 caractères minimum")
  .max(128, "128 caractères maximum")
  .refine((p) => !COMMON_PASSWORDS.has(p.toLowerCase()), "Mot de passe trop courant")
  .refine((p) => /[a-zA-Z]/.test(p) && /[0-9\W_]/.test(p), "Mélangez lettres et chiffres ou symboles");

const NOT_CONFIGURED: FormState = {
  error: "L'authentification n'est pas encore configurée sur cet environnement (Supabase). Aucune donnée n'a été envoyée.",
};

function fieldErrors(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of err.issues) out[String(i.path[0])] ??= i.message;
  return out;
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

  const next = parsed.data.formule ? `/app/abonnement/essai?formule=${parsed.data.formule}` : "/app/bienvenue";
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${appUrl()}/auth/confirm?next=${encodeURIComponent(next)}`,
      data: { display_name: parsed.data.displayName || null },
    },
  });
  if (error) {
    // Message générique : ne révèle pas si l'adresse possède déjà un compte.
    if (error.status === 429) return { error: "Trop de tentatives. Réessayez dans quelques minutes.", values };
    if (/password/i.test(error.message)) return { fieldErrors: { password: "Ce mot de passe n'est pas accepté, choisissez-en un plus robuste." }, values };
    console.error("signup_error", error.status);
    return { error: "Inscription impossible pour le moment. Réessayez plus tard.", values };
  }
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

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    if (error.code === "email_not_confirmed") {
      return { error: "Votre adresse e-mail n'est pas encore vérifiée. Consultez l'e-mail de confirmation.", values };
    }
    return { error: "Adresse e-mail ou mot de passe incorrect.", values };
  }
  const next = safeNext(String(form.get("suivant") ?? ""), "/app");
  if (data.user?.factors?.some((f) => f.status === "verified")) redirect(mfaChallengePath(next));
  redirect(next);
}

/** Deuxième étape de connexion : code à 6 chiffres de l'application d'authentification (TOTP). */
export async function mfaChallengeAction(_: FormState, form: FormData): Promise<FormState> {
  if (!isAuthConfigured()) return NOT_CONFIGURED;
  const next = safeNext(String(form.get("suivant") ?? ""), "/app");
  const code = String(form.get("code") ?? "").replace(/\s/g, "");
  if (!/^\d{6}$/.test(code)) return { fieldErrors: { code: "Saisissez les 6 chiffres affichés par votre application" } };
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/connexion?erreur=session");
  const factor = data.user.factors?.find((f) => f.status === "verified" && f.factor_type === "totp");
  if (!factor) redirect(next);
  const rl = await rateLimit(`mfa:${data.user.id}`, 10, 900);
  if (!rl.ok) return { error: "Trop de codes saisis. Réessayez dans 15 minutes." };
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
  if (error) return { fieldErrors: { code: "Code incorrect ou expiré. Saisissez le code affiché actuellement." } };
  redirect(next);
}

export async function forgotPasswordAction(_: FormState, form: FormData): Promise<FormState> {
  if (!isAuthConfigured()) return NOT_CONFIGURED;
  const parsed = z.object({ email: z.string().trim().toLowerCase().email("Adresse e-mail invalide") }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  const ip = ipKey(await clientIp());
  const rl = await rateLimit(`reset:${ip}`, 5, 3600);
  if (rl.ok) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.resetPasswordForEmail(parsed.data.email, {
      redirectTo: `${appUrl()}/auth/confirm?next=${encodeURIComponent("/reinitialiser-mot-de-passe")}`,
    });
  }
  // Réponse identique dans tous les cas (pas d'énumération des comptes).
  return { message: "Si un compte existe pour cette adresse, un e-mail de réinitialisation vient d'être envoyé." };
}

export async function resetPasswordAction(_: FormState, form: FormData): Promise<FormState> {
  if (!isAuthConfigured()) return NOT_CONFIGURED;
  const parsed = z
    .object({ password: passwordSchema, confirm: z.string() })
    .refine((v) => v.password === v.confirm, { message: "Les mots de passe ne correspondent pas", path: ["confirm"] })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { error: "Le lien de réinitialisation a expiré. Demandez-en un nouveau." };
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: "Impossible de modifier le mot de passe. Choisissez-en un autre ou réessayez." };
  // Déconnecte les autres sessions après un changement de mot de passe.
  await supabase.auth.signOut({ scope: "others" });
  redirect("/app?mot-de-passe=modifie");
}

export async function resendConfirmationAction(_: FormState, form: FormData): Promise<FormState> {
  if (!isAuthConfigured()) return NOT_CONFIGURED;
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  if (!z.string().email().safeParse(email).success) return { error: "Adresse e-mail invalide." };
  const rl = await rateLimit(`resend:${ipKey(email)}`, 3, 3600);
  if (rl.ok) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.resend({ type: "signup", email, options: { emailRedirectTo: `${appUrl()}/auth/confirm?next=/app/bienvenue` } });
  }
  return { message: "Si l'adresse doit encore être vérifiée, un nouvel e-mail a été envoyé." };
}
