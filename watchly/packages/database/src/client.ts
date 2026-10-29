import { sql, type SQL } from "drizzle-orm";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Database = PostgresJsDatabase<typeof schema>;
export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
export type Executor = Database | Transaction;

export interface CreateDbOptions {
  /** Taille du pool. Sur Vercel (serverless) garder une petite valeur et utiliser le pooler Supabase. */
  max?: number;
  /** Nom applicatif visible dans pg_stat_activity. */
  applicationName?: string;
}

export interface DbHandle {
  db: Database;
  client: postgres.Sql;
  close: () => Promise<void>;
}

export function createDb(url: string, options: CreateDbOptions = {}): DbHandle {
  const client = postgres(url, {
    max: options.max ?? 5,
    idle_timeout: 20,
    connect_timeout: 10,
    // Requis avec le pooler Supabase en mode transaction (pas de requêtes préparées nommées).
    prepare: false,
    onnotice: () => undefined,
    connection: { application_name: options.applicationName ?? "watchly" },
  });
  const db = drizzle(client, { schema });
  return { db, client, close: () => client.end({ timeout: 5 }) };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function assertUuid(value: string, label = "id"): string {
  if (!UUID_RE.test(value)) throw new Error(`invalid ${label}`);
  return value;
}

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

/**
 * Exécute `fn` dans une transaction avec le rôle Postgres `authenticated` et les claims JWT
 * de l'utilisateur : les politiques RLS s'appliquent donc à toutes les lectures effectuées
 * dans `fn` (défense en profondeur en plus des filtres applicatifs).
 */
export async function withUser<T>(db: Database, userId: string, fn: (tx: Transaction) => Promise<T>): Promise<T> {
  assertUuid(userId, "user id");
  return db.transaction(async (tx) => {
    const claims = JSON.stringify({ sub: userId, role: "authenticated" });
    await tx.execute(sql`select set_config('request.jwt.claims', ${claims}, true)`);
    await tx.execute(sql`set local role authenticated`);
    return fn(tx);
  });
}

/** Retrouve le code SQLSTATE d'une erreur PostgreSQL, même enveloppée par Drizzle. */
export function pgErrorCode(err: unknown): string | undefined {
  let current: unknown = err;
  for (let depth = 0; depth < 5 && current; depth++) {
    if (typeof current === "object" && current !== null) {
      const code = (current as { code?: unknown }).code;
      if (typeof code === "string" && /^[0-9A-Z]{5}$/.test(code)) return code;
      current = (current as { cause?: unknown }).cause;
    } else break;
  }
  return undefined;
}

export const PG_INSUFFICIENT_PRIVILEGE = "42501";
export const PG_UNIQUE_VIOLATION = "23505";

/** Paramètre horodaté pour le SQL brut (le pilote attend des chaînes pour les types date). */
export function tsParam(d: Date): SQL {
  return sql`${d.toISOString()}::timestamptz`;
}
