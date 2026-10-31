/**
 * Usage : DATABASE_URL=postgres://... pnpm db:migrate
 * Applique les migrations de db/migrations sur un PostgreSQL 15+ (auto-hébergé ou local).
 */
import postgres from "postgres";
import { runMigrations } from "../src/migrations";

const url = process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL (ou DATABASE_URL_DIRECT) est requis");
  process.exit(1);
}
const sql = postgres(url, { max: 1, onnotice: () => undefined });
try {
  const applied = await runMigrations(sql, { log: (m) => console.info(m) });
  console.info(applied.length ? `${applied.length} migration(s) appliquée(s)` : "Base à jour");
} finally {
  await sql.end();
}
