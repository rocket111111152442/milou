import "server-only";
import { recomputeEntitlements } from "@waverti/billing";
import { adminAuditLogs, betaGrants, eq, profiles, users, type Database } from "@waverti/database";
import { autoBetaGrant, isBootstrapAdmin, isInvited } from "./beta";

/**
 * À la confirmation de l'adresse : accès bêta automatique pour une adresse invitée et rôle administrateur
 * pour une adresse d'amorçage (réglages Vercel de LULLIN WEB, cf. lib/beta.ts). Idempotent ; journalisé.
 */
export async function applyInvitation(db: Database, userId: string, now = new Date()): Promise<void> {
  const [u] = await db.select({ email: users.email }).from(users).where(eq(users.id, userId)).limit(1);
  if (!u) return;
  if (isBootstrapAdmin(u.email)) {
    const changed = await db
      .update(profiles)
      .set({ role: "admin" })
      .where(eq(profiles.id, userId))
      .returning({ id: profiles.id });
    if (changed.length) {
      await db.insert(adminAuditLogs).values({ adminId: null, action: "user.grant_admin", targetType: "user", targetId: userId, reason: "WAVERTI_BOOTSTRAP_ADMINS" });
    }
  }
  const grant = autoBetaGrant();
  if (grant && isInvited(u.email)) {
    const inserted = await db
      .insert(betaGrants)
      .values({ userId, planId: grant.planId, reason: "Invitation bêta privée (liste d'accès)", startsAt: now, expiresAt: new Date(now.getTime() + grant.days * 86_400_000) })
      .onConflictDoNothing()
      .returning({ id: betaGrants.userId });
    if (inserted.length) {
      await db.insert(adminAuditLogs).values({ adminId: null, action: "beta.grant", targetType: "user", targetId: userId, reason: "WAVERTI_BETA_AUTO_GRANT", metadata: { plan: grant.planId, days: grant.days } });
      await recomputeEntitlements(db, userId, now);
    }
  }
}
