/**
 * Sauvegarde puis RESTAURATION réelle (infra/backup) : une sauvegarde n'est valable que si elle se restaure.
 * Nécessite pg_dump / pg_restore de même version majeure que le serveur ; sinon PG_DUMP / PG_RESTORE / PSQL
 * peuvent désigner les outils du conteneur (ex. « docker exec -i waverti-pg pg_dump »).
 */
import { execFileSync, execSync } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDatabase, createTestUser, type TestDatabase } from "../src/testing";
import { withUser } from "../src/client";
import { sql } from "drizzle-orm";

const ROOT = join(import.meta.dirname, "../../..");
let t: TestDatabase;
let dir: string;

function clientMajor(cmd: string): number {
  try {
    return Number(/(\d+)\.\d+/.exec(execSync(`${cmd} --version`, { encoding: "utf8" }))?.[1] ?? 0);
  } catch {
    return 0;
  }
}

beforeAll(async () => {
  t = await createTestDatabase();
  dir = mkdtempSync(join(tmpdir(), "waverti-backup-"));
});
afterAll(async () => {
  await t?.drop();
  if (dir) rmSync(dir, { recursive: true, force: true });
});

describe("sauvegarde et restauration", () => {
  it("restaure une sauvegarde complète dans une base vierge (données, RLS et droits compris)", async (ctx) => {
    const [{ server_version_num }] = (await t.client`show server_version_num`) as unknown as [{ server_version_num: string }];
    const serverMajor = Math.floor(Number(server_version_num) / 10000);
    const pgDump = process.env.PG_DUMP ?? "pg_dump";
    if (!process.env.PG_DUMP && clientMajor(pgDump) < serverMajor) {
      ctx.skip(`pg_dump ${clientMajor(pgDump)} < serveur ${serverMajor} : définir PG_DUMP/PG_RESTORE/PSQL (outils du conteneur)`);
    }
    const u = await createTestUser(t);
    await t.client`insert into monitoring_tasks (user_id, kind, name, condition) values (${u.id}, 'page', 'Casque', '{"type":"page_changed"}'::jsonb)`;

    // Les outils du conteneur ne voient pas « localhost » de l'hôte de la même façon : URL fournie telle quelle.
    const url = process.env.BACKUP_TEST_DB_URL_PREFIX ? `${process.env.BACKUP_TEST_DB_URL_PREFIX}/${t.name}` : t.url;
    const out = execFileSync("bash", [join(ROOT, "infra/backup/pg-backup.sh")], {
      env: { ...process.env, DATABASE_URL: url, BACKUP_DIR: dir, PG_DUMP: pgDump },
      encoding: "utf8",
    }).trim();
    const files = readdirSync(dir);
    expect(files.some((f) => f.endsWith(".dump"))).toBe(true);
    expect(files.some((f) => f.endsWith(".dump.sha256"))).toBe(true);

    const adminPrefix = process.env.BACKUP_TEST_DB_URL_PREFIX ?? t.url.replace(/\/[^/]+$/, "");
    const check = execFileSync("bash", [join(ROOT, "infra/backup/pg-restore-check.sh"), out], {
      env: { ...process.env, ADMIN_URL: `${adminPrefix}/postgres` },
      encoding: "utf8",
    });
    expect(check).toMatch(/users=1 profiles=1 tasks=1 plans=4/);
    expect(check).toContain("Restauration vérifiée");

    // Restauration manuelle conservée pour vérifier la RLS sur la copie restaurée.
    const copy = `${t.name}_restored`;
    await t.client.unsafe(`create database ${copy}`);
    try {
      execSync(`${process.env.PG_RESTORE ?? "pg_restore"} --no-owner --exit-on-error --dbname=${adminPrefix}/${copy} < ${out}`, { shell: "/bin/bash" });
      const restored = postgres(t.url.replace(/\/[^/]+$/, `/${copy}`), { max: 1, onnotice: () => undefined });
      try {
        const { drizzle } = await import("drizzle-orm/postgres-js");
        const db = drizzle(restored);
        const mine = await withUser(db as never, u.id, (tx) => tx.execute(sql`select name from monitoring_tasks`));
        expect(mine.length).toBe(1);
        const other = await withUser(db as never, "00000000-0000-4000-8000-000000000000", (tx) => tx.execute(sql`select name from monitoring_tasks`));
        expect(other.length).toBe(0);
      } finally {
        await restored.end();
      }
    } finally {
      await t.client.unsafe(`drop database if exists ${copy} with (force)`);
    }
  });
});
