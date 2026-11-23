import pg from "pg";

/** Base de test remise à zéro puis migrée avec les migrations versionnées. */
export default async function setup() {
  const url = process.env.TEST_DATABASE_URL ?? "postgresql://antonio:antonio@localhost:5432/antonio_test";
  process.env.DATABASE_URL = url;
  const c = new pg.Client({ connectionString: url });
  await c.connect();
  await c.query("DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public; DROP SCHEMA IF EXISTS drizzle CASCADE; DROP SCHEMA IF EXISTS pgboss CASCADE;");
  await c.end();
  const { runMigrations } = await import("../src/migrate.js");
  const { closeDb } = await import("../src/db/client.js");
  await runMigrations();
  await closeDb();
}
