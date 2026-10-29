/**
 * Donne (ou retire) le rôle administrateur à un compte existant. Volontairement disponible
 * UNIQUEMENT en ligne de commande, avec l'accès direct à la base : aucune page du site ne le permet.
 *
 * Usage (depuis la racine) : DATABASE_URL=postgres://… pnpm admin:grant prenom@lullin-web.com [--revoke]
 */
import postgres from "postgres";

const email = process.argv[2]?.trim().toLowerCase();
const revoke = process.argv.includes("--revoke");
const url = process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL;
if (!email || !url) {
  console.error("Usage : DATABASE_URL=… pnpm admin:grant adresse@exemple.fr [--revoke]");
  process.exit(1);
}
const sql = postgres(url, { max: 1, onnotice: () => undefined });
try {
  const rows = await sql<{ id: string }[]>`
    update profiles set role = ${revoke ? "user" : "admin"} where lower(email) = ${email} returning id`;
  if (!rows.length) {
    console.error("Aucun compte avec cette adresse. Le compte doit d'abord être créé depuis le site.");
    process.exitCode = 1;
  } else {
    await sql`insert into admin_audit_logs (admin_id, action, target_type, target_id, reason)
              values (null, ${revoke ? "user.revoke_admin" : "user.grant_admin"}, 'user', ${rows[0]!.id}, 'ligne de commande')`;
    console.log(`${email} : rôle ${revoke ? "utilisateur" : "administrateur"} appliqué.`);
  }
} finally {
  await sql.end();
}
