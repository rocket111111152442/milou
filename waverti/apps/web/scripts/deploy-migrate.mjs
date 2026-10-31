/**
 * Migrations de la base au déploiement de PRODUCTION sur Vercel, avant `next build`.
 * - Ne fait rien hors Vercel Production (machines locales, CI, Preview) ni sans DATABASE_URL.
 * - Idempotent : migrations suivies dans waverti_migrations.schema_migrations, verrou consultatif
 *   (deux déploiements simultanés ne se chevauchent pas). Un échec de migration fait échouer le
 *   déploiement : l'ancienne version reste en ligne.
 * - N'affiche jamais l'adresse de connexion.
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

if (process.env.VERCEL_ENV !== "production") {
  console.log("[migrations] ignorées (environnement : " + (process.env.VERCEL_ENV ?? "local") + ")");
  process.exit(0);
}
if (!process.env.DATABASE_URL && !process.env.DATABASE_URL_UNPOOLED) {
  console.log("[migrations] ignorées : DATABASE_URL absent (le site indique que le service n'est pas configuré)");
  process.exit(0);
}
const script = fileURLToPath(new URL("../../../packages/database/scripts/migrate.ts", import.meta.url));
// Connexion directe (sans pooler) si l'intégration la fournit : verrous et transactions longues.
const env = { ...process.env, DATABASE_URL_DIRECT: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL };
const r = spawnSync("tsx", [script], { stdio: "inherit", env, shell: process.platform === "win32" });
process.exit(r.status ?? 1);
