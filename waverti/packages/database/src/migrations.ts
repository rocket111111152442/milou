import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type postgres from "postgres";

const here = dirname(fileURLToPath(import.meta.url));
export const MIGRATIONS_DIR = resolve(here, "../../../db/migrations");

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
 * Applique, dans l'ordre et chacune dans sa transaction, les migrations non encore appliquées
 * (suivi dans waverti_migrations.schema_migrations). Verrou consultatif : deux déploiements
 * simultanés ne peuvent pas appliquer la même migration.
 */
export async function runMigrations(sql: postgres.Sql, options: { log?: (msg: string) => void } = {}): Promise<string[]> {
  const log = options.log ?? (() => undefined);
  await sql.unsafe(`
    create schema if not exists waverti_migrations;
    create table if not exists waverti_migrations.schema_migrations (
      version text primary key,
      name text not null,
      applied_at timestamptz not null default now()
    );
  `);
  const done: string[] = [];
  await sql.begin(async (lock) => {
    await lock`select pg_advisory_xact_lock(7461001)`;
    const applied = new Set(
      (await lock<{ version: string }[]>`select version from waverti_migrations.schema_migrations`).map((r) => r.version),
    );
    for (const m of listMigrations()) {
      if (applied.has(m.version)) continue;
      const content = readFileSync(m.path, "utf8");
      await lock.savepoint(async (tx) => {
        await tx.unsafe(content);
        await tx`insert into waverti_migrations.schema_migrations (version, name) values (${m.version}, ${m.name})`;
      });
      log(`applied ${m.version}_${m.name}`);
      done.push(m.version);
    }
  });
  return done;
}
