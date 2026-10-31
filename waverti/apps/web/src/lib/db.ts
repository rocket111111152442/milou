import "server-only";
import { createDb, type Database } from "@waverti/database";
import { databaseUrl } from "./database-url";

export { databaseUrl };

declare global {
  var __wavertiDb: { db: Database; close: () => Promise<void> } | undefined;
}

/** Connexion partagée (une par instance serverless). Petit pool par instance (DATABASE_POOL_MAX). */
export function getDb(): Database {
  const url = databaseUrl();
  if (!url) throw new DatabaseUnavailableError();
  if (!globalThis.__wavertiDb) {
    const handle = createDb(url, { max: Number(process.env.DATABASE_POOL_MAX ?? 3), applicationName: "waverti-web" });
    globalThis.__wavertiDb = { db: handle.db, close: handle.close };
  }
  return globalThis.__wavertiDb.db;
}

export function isDatabaseConfigured(): boolean {
  return databaseUrl() !== null;
}

export class DatabaseUnavailableError extends Error {
  constructor() {
    super("DATABASE_URL n'est pas configurée");
    this.name = "DatabaseUnavailableError";
  }
}
