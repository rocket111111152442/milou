/**
 * Garde-fou des outils de recette : refuse de continuer si DATABASE_URL ne désigne pas la base de TEST de la
 * Preview (marqueur app_settings.environment = "preview", posé par le déploiement Preview uniquement).
 * N'affiche jamais l'adresse de connexion.
 */
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL absent");
  process.exit(1);
}
const sql = postgres(url, { max: 1, onnotice: () => undefined, connect_timeout: 15 });
try {
  const rows = await sql<{ value: unknown }[]>`select value from app_settings where key = 'environment'`;
  if (rows[0]?.value !== "preview") {
    console.error("Base refusée : ce n'est pas la base de TEST de la Preview (marqueur absent). Aucune action effectuée.");
    process.exit(1);
  }
  const [m] = await sql<{ n: number }[]>`select count(*)::int as n from waverti_migrations.schema_migrations`;
  console.info(`Base de TEST de la Preview confirmée (${m?.n ?? 0} migrations).`);
} finally {
  await sql.end();
}
