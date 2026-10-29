import "server-only";
import { createDb, type Database } from "@watchly/database";

declare global {
  var __watchlyDb: { db: Database; close: () => Promise<void> } | undefined;
}

/** Connexion partagée (une par instance serverless). Le pooler Supabase gère la mutualisation. */
export function getDb(): Database {
  const url = process.env.DATABASE_URL;
  if (!url) throw new DatabaseUnavailableError();
  if (!globalThis.__watchlyDb) {
    const handle = createDb(url, { max: Number(process.env.DATABASE_POOL_MAX ?? 3), applicationName: "watchly-web" });
    globalThis.__watchlyDb = { db: handle.db, close: handle.close };
  }
  return globalThis.__watchlyDb.db;
}

export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export class DatabaseUnavailableError extends Error {
  constructor() {
    super("DATABASE_URL n'est pas configurée");
    this.name = "DatabaseUnavailableError";
  }
}
