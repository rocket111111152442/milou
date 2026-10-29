import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { authenticateDevice, bearerFrom, type Role } from "@watchly/auth";
import { eq, profiles } from "@watchly/database";
import { getDb, isDatabaseConfigured } from "./db";
import { createSupabaseServerClient, isAuthConfigured } from "./supabase/server";

export interface CurrentUser {
  id: string;
  email: string;
  role: Role;
  suspended: boolean;
  displayName: string | null;
  onboardingCompletedAt: Date | null;
  timezone: string;
  /** Double authentification (TOTP) : activée sur le compte, et validée pour la session en cours (aal2). */
  mfa: { enrolled: boolean; verified: boolean; factorId: string | null; since: string | null };
}

/** Page de saisie du code de double authentification, avec retour vers `next` après validation. */
export function mfaChallengePath(next: string): string {
  return `/connexion/double-authentification?suivant=${encodeURIComponent(next)}`;
}

/**
 * Utilisateur courant, validé auprès du serveur d'authentification (getUser) puis enrichi
 * par le profil en base (rôle, suspension). Mis en cache pour la durée de la requête.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  // Lecture des cookies en premier : marque la route comme dynamique même sans configuration.
  await cookies();
  if (!isAuthConfigured() || !isDatabaseConfigured()) return null;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  const [p] = await getDb()
    .select({
      role: profiles.role,
      email: profiles.email,
      suspendedAt: profiles.suspendedAt,
      displayName: profiles.displayName,
      onboardingCompletedAt: profiles.onboardingCompletedAt,
      timezone: profiles.timezone,
    })
    .from(profiles)
    .where(eq(profiles.id, data.user.id))
    .limit(1);
  if (!p) return null;
  // Facteurs lus sur l'utilisateur renvoyé par le serveur d'authentification (pas sur le cookie).
  const factor = data.user.factors?.find((f) => f.status === "verified" && f.factor_type === "totp") ?? null;
  let verified = false;
  if (factor) {
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    verified = aal?.currentLevel === "aal2";
  }
  return {
    id: data.user.id,
    email: p.email || data.user.email || "",
    role: p.role,
    suspended: Boolean(p.suspendedAt),
    displayName: p.displayName,
    onboardingCompletedAt: p.onboardingCompletedAt,
    timezone: p.timezone,
    mfa: { enrolled: Boolean(factor), verified, factorId: factor?.id ?? null, since: factor?.created_at ?? null },
  };
});

export async function requireUser(nextPath = "/app"): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/connexion?suivant=${encodeURIComponent(nextPath)}`);
  if (user.suspended) redirect("/compte-suspendu");
  // Mot de passe seul : la session n'ouvre rien tant que le code de double authentification n'est pas saisi.
  if (user.mfa.enrolled && !user.mfa.verified) redirect(mfaChallengePath((await headers()).get("x-watchly-path") ?? nextPath));
  return user;
}

/** Accès administrateur : vérifié côté serveur ; un non-admin reçoit une 404 (pas d'indice d'existence). */
export async function requireAdmin(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user || user.suspended || user.role !== "admin") notFound();
  if (user.mfa.enrolled && !user.mfa.verified) redirect(mfaChallengePath("/admin"));
  // ADMIN_REQUIRE_MFA=1 : un administrateur sans double authentification est invité à l'activer.
  if (process.env.ADMIN_REQUIRE_MFA === "1" && !user.mfa.verified) redirect("/app/parametres?double-authentification=requise#double-authentification");
  return user;
}

export type RequestActor =
  | { kind: "user"; userId: string; role: Role }
  | { kind: "device"; userId: string; deviceId: string; monitoringEnabled: boolean; consentLocalAt: Date | null };

/**
 * Authentification des routes API : jeton d'appareil (application desktop, en-tête Bearer)
 * ou session web (cookies). Les comptes suspendus sont refusés.
 */
export async function authenticateRequest(req: Request): Promise<RequestActor | null> {
  if (!isDatabaseConfigured()) return null;
  const bearer = bearerFrom(req.headers.get("authorization"));
  if (bearer) {
    const device = await authenticateDevice(getDb(), bearer);
    if (!device) return null;
    const [p] = await getDb().select({ suspendedAt: profiles.suspendedAt }).from(profiles).where(eq(profiles.id, device.userId)).limit(1);
    if (!p || p.suspendedAt) return null;
    return { kind: "device", ...device };
  }
  const user = await getCurrentUser();
  if (!user || user.suspended) return null;
  if (user.mfa.enrolled && !user.mfa.verified) return null;
  return { kind: "user", userId: user.id, role: user.role };
}
