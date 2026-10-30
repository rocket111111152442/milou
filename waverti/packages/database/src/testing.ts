/**
 * Outils de test : crée une base PostgreSQL isolée et migrée par suite de tests.
 * Nécessite TEST_DATABASE_URL pointant vers un serveur où l'utilisateur peut créer des bases.
 */
import { createHash, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import postgres from "postgres";
import { createDb, type DbHandle } from "./client";
import { listMigrations, runMigrations, SHIM_FILE } from "./migrations";

/**
 * Nom de la base modèle dérivé du contenu des migrations : toute modification du schéma produit
 * automatiquement un nouveau modèle (jamais de tests exécutés sur un schéma périmé).
 */
function templateName(): string {
  const h = createHash("sha256");
  for (const f of [...listMigrations().map((m) => m.path), SHIM_FILE]) h.update(readFileSync(f));
  return `waverti_test_tpl_${h.digest("hex").slice(0, 12)}`;
}
const TEMPLATE = templateName();

export function testAdminUrl(): string {
  return process.env.TEST_DATABASE_URL ?? "postgres://postgres:postgres@127.0.0.1:5432/postgres";
}

function withDatabase(url: string, database: string): string {
  const u = new URL(url);
  u.pathname = `/${database}`;
  return u.toString();
}

let templateReady: Promise<void> | null = null;

async function ensureTemplate(adminUrl: string): Promise<void> {
  const admin = postgres(adminUrl, { max: 1, onnotice: () => undefined });
  try {
    // Verrou consultatif : plusieurs workers Vitest peuvent démarrer en parallèle.
    await admin`select pg_advisory_lock(424242)`;
    const exists = await admin`select 1 from pg_database where datname = ${TEMPLATE}`;
    if (exists.length === 0 || process.env.WAVERTI_REBUILD_TEST_TEMPLATE === "1") {
      if (exists.length) await admin.unsafe(`drop database ${TEMPLATE}`);
      await admin.unsafe(`create database ${TEMPLATE}`);
      const t = postgres(withDatabase(adminUrl, TEMPLATE), { max: 1, onnotice: () => undefined });
      try {
        await runMigrations(t, { withLocalShim: true });
      } finally {
        await t.end();
      }
    }
    await admin`select pg_advisory_unlock(424242)`;
  } finally {
    await admin.end();
  }
}

export interface TestDatabase extends DbHandle {
  url: string;
  name: string;
  drop: () => Promise<void>;
}

export async function createTestDatabase(): Promise<TestDatabase> {
  const adminUrl = testAdminUrl();
  templateReady ??= ensureTemplate(adminUrl);
  await templateReady;
  const name = `waverti_test_${randomBytes(6).toString("hex")}`;
  const admin = postgres(adminUrl, { max: 1, onnotice: () => undefined });
  try {
    await admin.unsafe(`create database ${name} template ${TEMPLATE}`);
  } finally {
    await admin.end();
  }
  const url = withDatabase(adminUrl, name);
  const handle = createDb(url, { max: 10, applicationName: "waverti-test" });
  return {
    ...handle,
    url,
    name,
    drop: async () => {
      await handle.close();
      const a = postgres(adminUrl, { max: 1, onnotice: () => undefined });
      try {
        await a.unsafe(`drop database if exists ${name} with (force)`);
      } finally {
        await a.end();
      }
    },
  };
}

/** Crée un utilisateur dans auth.users (shim local) ; le trigger crée le profil. */
export async function createTestUser(
  handle: DbHandle,
  email = `user-${randomBytes(4).toString("hex")}@example.test`,
): Promise<{ id: string; email: string }> {
  const [row] = await handle.client<{ id: string }[]>`
    insert into auth.users (email, email_confirmed_at) values (${email}, now()) returning id`;
  return { id: row!.id, email };
}
