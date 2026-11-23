import { migrate } from "drizzle-orm/node-postgres/migrator";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { existsSync } from "node:fs";
import { db } from "./db/client.js";

/** Applique les migrations SQL versionnées (dossier server/migrations). */
export async function runMigrations() {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [resolve(here, "../migrations"), resolve(here, "../../migrations"), resolve(process.cwd(), "migrations")];
  const folder = candidates.find((p) => existsSync(p));
  if (!folder) throw new Error("Dossier de migrations introuvable");
  await db().execute("CREATE EXTENSION IF NOT EXISTS pgcrypto" as never);
  await migrate(db(), { migrationsFolder: folder });
}
