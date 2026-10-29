import "server-only";
import { cache } from "react";
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
}

/**
 * Utilisateur courant, validé auprès du serveur d'authentification (getUser) puis enrichi
 * par le profil en base (rôle, suspension). Mis en cache pour la durée de la requête.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
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
  return {
    id: data.user.id,
    email: p.email || data.user.email || "",
    role: p.role,
    suspended: Boolean(p.suspendedAt),
    displayName: p.displayName,
    onboardingCompletedAt: p.onboardingCompletedAt,
    timezone: p.timezone,
  };
});

export async function requireUser(nextPath = "/app"): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/connexion?suivant=${encodeURIComponent(nextPath)}`);
  if (user.suspended) redirect("/compte-suspendu");
  return user;
}

/** Accès administrateur : vérifié côté serveur ; un non-admin reçoit une 404 (pas d'indice d'existence). */
export async function requireAdmin(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user || user.suspended || user.role !== "admin") notFound();
  if (process.env.ADMIN_REQUIRE_MFA === "1") {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (data?.currentLevel !== "aal2") notFound();
  }
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
  return { kind: "user", userId: user.id, role: user.role };
}
