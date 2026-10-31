/**
 * Accès bêta privé, sans paiement — LIGNE DE COMMANDE UNIQUEMENT (aucune page du site ne le permet).
 *
 *   DATABASE_URL=… pnpm beta:grant testeur@exemple.fr --plan pro --days 30 --reason "Bêta privée novembre"
 *   DATABASE_URL=… pnpm beta:grant testeur@exemple.fr --revoke
 *   DATABASE_URL=… pnpm beta:grant --list
 *
 * Durée : 60 jours au plus, expiration automatique. Quotas stricts (BETA_CAPS). Un abonnement réel reste
 * prioritaire. Chaque action est inscrite dans le journal d'audit de l'administration.
 */
import { adminAuditLogs, betaGrants, createDb, eq, profiles } from "@waverti/database";
import { BETA_MAX_DAYS, isPaidPlanId, recomputeEntitlements } from "../src";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const url = process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL est requis.");
  const { db, close } = createDb(url, { max: 1 });
  try {
    if (process.argv.includes("--list")) {
      const rows = await db
        .select({ email: profiles.email, plan: betaGrants.planId, expires: betaGrants.expiresAt, revoked: betaGrants.revokedAt, reason: betaGrants.reason })
        .from(betaGrants)
        .innerJoin(profiles, eq(profiles.id, betaGrants.userId));
      for (const r of rows) {
        const state = r.revoked ? "révoqué" : r.expires.getTime() <= Date.now() ? "expiré" : `jusqu'au ${r.expires.toISOString().slice(0, 10)}`;
        console.info(`${r.email}\t${r.plan}\t${state}\t${r.reason}`);
      }
      if (!rows.length) console.info("Aucun accès bêta.");
      return;
    }
    const email = process.argv[2]?.trim().toLowerCase();
    if (!email || email.startsWith("--")) throw new Error("Adresse e-mail du compte attendue en premier argument.");
    const [profile] = await db.select({ id: profiles.id }).from(profiles).where(eq(profiles.email, email)).limit(1);
    if (!profile) throw new Error("Aucun compte avec cette adresse : la personne doit d'abord créer son compte sur le site.");

    if (process.argv.includes("--revoke")) {
      const done = await db.update(betaGrants).set({ revokedAt: new Date() }).where(eq(betaGrants.userId, profile.id)).returning({ id: betaGrants.userId });
      if (!done.length) throw new Error("Ce compte n'a pas d'accès bêta.");
      await db.insert(adminAuditLogs).values({ adminId: null, action: "beta.revoke", targetType: "user", targetId: profile.id, reason: "ligne de commande" });
      await recomputeEntitlements(db, profile.id);
      console.info(`${email} : accès bêta révoqué.`);
      return;
    }

    const plan = arg("plan") ?? "plus";
    if (!isPaidPlanId(plan)) throw new Error("--plan doit être plus, pro, max ou business.");
    const days = Number(arg("days") ?? "14");
    if (!Number.isInteger(days) || days < 1 || days > BETA_MAX_DAYS) throw new Error(`--days doit être un entier entre 1 et ${BETA_MAX_DAYS}.`);
    const reason = (arg("reason") ?? "").trim();
    if (reason.length < 3) throw new Error('--reason est obligatoire (ex. --reason "Bêta privée novembre").');
    const startsAt = new Date();
    const expiresAt = new Date(startsAt.getTime() + days * 86_400_000);
    await db
      .insert(betaGrants)
      .values({ userId: profile.id, planId: plan, reason, startsAt, expiresAt })
      .onConflictDoUpdate({ target: betaGrants.userId, set: { planId: plan, reason, startsAt, expiresAt, revokedAt: null } });
    await db.insert(adminAuditLogs).values({ adminId: null, action: "beta.grant", targetType: "user", targetId: profile.id, reason, metadata: { plan, days } });
    const e = await recomputeEntitlements(db, profile.id);
    console.info(
      `${email} : accès bêta ${plan} jusqu'au ${expiresAt.toISOString().slice(0, 10)} — ${e.source === "admin_grant" ? `${e.maxMonitors} surveillances, ${e.maxWebTopics} sujet(s)` : "un abonnement actif reste prioritaire"}.`,
    );
  } finally {
    await close();
  }
}

main().catch((err) => {
  console.error((err as Error).message);
  process.exitCode = 1;
});
