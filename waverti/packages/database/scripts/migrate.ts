/**
 * Usage : DATABASE_URL=postgres://... pnpm db:migrate [--local-shim]
 * --local-shim : à utiliser UNIQUEMENT sur un PostgreSQL local sans Supabase.
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
  const applied = await runMigrations(sql, {
    withLocalShim: process.argv.includes("--local-shim"),
    log: (m) => console.log(m),
  });
  console.log(applied.length ? `${applied.length} migration(s) appliquée(s)` : "Base à jour");
} finally {
  await sql.end();
}
