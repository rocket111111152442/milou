import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { authenticateDevice, bearerFrom, type Role } from "@waverti/auth";
import { eq, profiles } from "@waverti/database";
import { getDb, isDatabaseConfigured } from "./db";
import { getActiveSession, isAuthConfigured } from "./session";

export interface CurrentUser {
  id: string;
  email: string;
  role: Role;
  suspended: boolean;
  displayName: string | null;
  onboardingCompletedAt: Date | null;
  timezone: string;
  /** Double authentification (TOTP) : activée sur le compte, et validée pour la session en cours (aal2). */
  mfa: { enrolled: boolean; verified: boolean; since: string | null };
  /** Identifiant de la session courante (empreinte), pour fermer les autres sessions. */
  sessionId: string;
}

/** Page de saisie du code de double authentification, avec retour vers `next` après validation. */
export function mfaChallengePath(next: string): string {
  return `/connexion/double-authentification?suivant=${encodeURIComponent(next)}`;
}

/**
 * Utilisateur courant : session valide (cookie → empreinte en base) enrichie par le profil
 * (rôle, suspension). Mis en cache pour la durée de la requête.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  // Lecture des cookies en premier : marque la route comme dynamique même sans configuration.
  await cookies();
  if (!isAuthConfigured() || !isDatabaseConfigured()) return null;
  const session = await getActiveSession();
  if (!session) return null;
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
    .where(eq(profiles.id, session.userId))
    .limit(1);
  if (!p) return null;
  const enrolled = Boolean(session.user.totpEnabledAt && session.user.totpSecretEnc);
  return {
    id: session.userId,
    email: p.email || session.user.email,
    role: p.role,
    suspended: Boolean(p.suspendedAt),
    displayName: p.displayName,
    onboardingCompletedAt: p.onboardingCompletedAt,
    timezone: p.timezone,
    mfa: { enrolled, verified: enrolled && session.aal === 2, since: session.user.totpEnabledAt?.toISOString() ?? null },
    sessionId: session.id,
  };
});

export async function requireUser(nextPath = "/app"): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/connexion?suivant=${encodeURIComponent(nextPath)}`);
  if (user.suspended) redirect("/compte-suspendu");
  // Mot de passe seul : la session n'ouvre rien tant que le code de double authentification n'est pas saisi.
  if (user.mfa.enrolled && !user.mfa.verified) redirect(mfaChallengePath((await headers()).get("x-waverti-path") ?? nextPath));
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
