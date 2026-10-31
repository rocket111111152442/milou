/**
 * Bêta privée sur invitation (production), sans paiement :
 * - WAVERTI_SIGNUP_MODE=open : inscription ouverte à tous, même si une liste d'invitation existe (la liste sert
 *   alors seulement à l'accès bêta automatique et à l'administrateur d'amorçage).
 * - WAVERTI_SIGNUP_ALLOWLIST : adresses autorisées à créer un compte, séparées par des virgules. Si la variable
 *   est définie, l'inscription est fermée à toute autre adresse. Absente : inscription ouverte (développement, tests).
 * - WAVERTI_BETA_AUTO_GRANT : « formule:jours » (ex. « pro:30 »). À la confirmation de l'adresse d'un compte invité,
 *   un accès bêta limité est accordé automatiquement (mêmes règles que `pnpm beta:grant` : 60 jours au plus,
 *   quotas réduits, expiration automatique, un abonnement réel reste prioritaire).
 * - WAVERTI_BOOTSTRAP_ADMINS : adresses qui reçoivent le rôle administrateur à la confirmation de leur adresse
 *   (amorçage du premier administrateur sans accès direct à la base). La double authentification reste exigée.
 * Ces réglages sont faits dans Vercel par LULLIN WEB : aucun utilisateur ne peut les modifier depuis le site.
 */
import { isPaidPlanId, type PaidPlanId } from "@waverti/billing/catalog";

/** Durée maximale d'un accès bêta (identique à BETA_MAX_DAYS de @waverti/billing, imposée aussi par la base). */
const BETA_MAX_DAYS = 60;

type Env = Record<string, string | undefined>;

function list(value: string | undefined): string[] {
  return (value ?? "")
    .split(/[,;\s]+/)
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.includes("@"));
}

export function signupMode(env: Env = process.env): "open" | "invite" {
  if (env.WAVERTI_SIGNUP_MODE?.trim().toLowerCase() === "open") return "open";
  return env.WAVERTI_SIGNUP_ALLOWLIST !== undefined && env.WAVERTI_SIGNUP_ALLOWLIST.trim() !== "" ? "invite" : "open";
}

export function isInvited(email: string, env: Env = process.env): boolean {
  return list(env.WAVERTI_SIGNUP_ALLOWLIST).includes(email.trim().toLowerCase());
}

export function isSignupAllowed(email: string, env: Env = process.env): boolean {
  return signupMode(env) === "open" || isInvited(email, env);
}

export function autoBetaGrant(env: Env = process.env): { planId: PaidPlanId; days: number } | null {
  const raw = env.WAVERTI_BETA_AUTO_GRANT?.trim();
  if (!raw) return null;
  const [plan, d] = raw.split(":");
  const days = Number(d);
  if (!plan || !isPaidPlanId(plan) || !Number.isInteger(days) || days < 1) return null;
  return { planId: plan, days: Math.min(days, BETA_MAX_DAYS) };
}

export function isBootstrapAdmin(email: string, env: Env = process.env): boolean {
  return list(env.WAVERTI_BOOTSTRAP_ADMINS).includes(email.trim().toLowerCase());
}
