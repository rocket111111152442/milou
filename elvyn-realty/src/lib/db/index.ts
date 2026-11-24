import "server-only";
import path from "node:path";
import { mkdirSync } from "node:fs";
import { drizzle as drizzlePg, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { migrate as migratePg } from "drizzle-orm/node-postgres/migrator";
import * as schema from "./schema";
import { env } from "@/config/env";
import { log } from "@/lib/log";

/**
 * DATABASE_URL set  → PostgreSQL (production: Neon, Supabase, RDS…).
 * DATABASE_URL empty → embedded PGlite in .data/ (local preview and tests only).
 * Both use the same schema and SQL migrations in /drizzle.
 */
export type DB = NodePgDatabase<typeof schema>;

const g = globalThis as unknown as { __eaDb?: Promise<DB> };
const MIGRATIONS = path.join(process.cwd(), "drizzle");

/**
 * Optional bootstrap of the first CRM user from ADMIN_BOOTSTRAP_EMAIL + ADMIN_BOOTSTRAP_PASSWORD_HASH
 * (an scrypt hash from scripts/hash-password.ts, never a clear password). Used for previews
 * whose database starts empty; existing users are never modified.
 */
async function bootstrapAdmin(db: DB) {
  const email = process.env.ADMIN_BOOTSTRAP_EMAIL?.trim().toLowerCase();
  const hash = process.env.ADMIN_BOOTSTRAP_PASSWORD_HASH?.trim();
  if (!email || !hash?.startsWith("scrypt$")) return;
  await db.insert(schema.adminUsers).values({ email, name: process.env.ADMIN_BOOTSTRAP_NAME?.trim() || "Administrador", passwordHash: hash }).onConflictDoNothing();
}

async function create(): Promise<DB> {
  if (env.database.url) {
    const { Pool } = await import("pg");
    const pool = new Pool({ connectionString: env.database.url, max: 5, ssl: env.database.url.includes("sslmode=disable") ? false : { rejectUnauthorized: false } });
    const db = drizzlePg(pool, { schema });
    if (process.env.DB_AUTO_MIGRATE !== "false") await migratePg(db, { migrationsFolder: MIGRATIONS });
    await bootstrapAdmin(db);
    return db;
  }
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  const dir = env.database.pgliteDir === "memory://" ? "memory://" : path.resolve(process.cwd(), env.database.pgliteDir);
  if (dir !== "memory://") mkdirSync(dir, { recursive: true });
  const client = new PGlite(dir);
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: MIGRATIONS });
  await bootstrapAdmin(db as unknown as DB);
  log.info("db.pglite_ready", { memory: dir === "memory://" });
  return db as unknown as DB;
}

export function getDb(): Promise<DB> {
  if (!g.__eaDb) {
    g.__eaDb = create().catch((err) => {
      g.__eaDb = undefined;
      log.error("db.init_failed", { reason: (err as Error).message });
      throw err;
    });
  }
  return g.__eaDb;
}

export { schema };
