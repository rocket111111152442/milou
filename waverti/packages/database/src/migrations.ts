import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type postgres from "postgres";

const here = dirname(fileURLToPath(import.meta.url));
export const MIGRATIONS_DIR = resolve(here, "../../../supabase/migrations");
export const SHIM_FILE = resolve(here, "../sql/local-supabase-shim.sql");

export interface MigrationFile {
  version: string;
  name: string;
  path: string;
}

export function listMigrations(dir = MIGRATIONS_DIR): MigrationFile[] {
  return readdirSync(dir)
    .filter((f) => /^\d{14}_[a-z0-9_]+\.sql$/.test(f))
    .sort()
    .map((f) => {
      const [version, ...rest] = f.replace(/\.sql$/, "").split("_");
      return { version: version!, name: rest.join("_"), path: join(dir, f) };
    });
}

/**
 * Applique les migrations non encore appliquées. Utilise la même table de suivi que la CLI
 * Supabase (supabase_migrations.schema_migrations) pour rester compatible avec `supabase db push`.
 */
export async function runMigrations(
  sql: postgres.Sql,
  options: { withLocalShim?: boolean; log?: (msg: string) => void } = {},
): Promise<string[]> {
  const log = options.log ?? (() => undefined);
  if (options.withLocalShim) {
    await sql.unsafe(readFileSync(SHIM_FILE, "utf8"));
    log("local supabase shim applied");
  }
  await sql.unsafe(`
    create schema if not exists supabase_migrations;
    create table if not exists supabase_migrations.schema_migrations (
      version text primary key,
      statements text[],
      name text
    );
  `);
  const applied = new Set(
    (await sql<{ version: string }[]>`select version from supabase_migrations.schema_migrations`).map(
      (r) => r.version,
    ),
  );
  const done: string[] = [];
  for (const m of listMigrations()) {
    if (applied.has(m.version)) continue;
    const content = readFileSync(m.path, "utf8");
    await sql.begin(async (tx) => {
      await tx.unsafe(content);
      await tx`insert into supabase_migrations.schema_migrations (version, name) values (${m.version}, ${m.name})`;
    });
    log(`applied ${m.version}_${m.name}`);
    done.push(m.version);
  }
  return done;
}
