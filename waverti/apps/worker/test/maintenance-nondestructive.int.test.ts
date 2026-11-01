/**
 * Garantie de non-destruction : sans droits de stockage Brave, la maintenance horaire ne modifie ni ne supprime
 * aucune donnée existante (comptes, e-mails de confirmation, notifications, historique, caches Brave).
 * Base jetable ; aucune donnée réelle.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDatabase, createTestUser, type TestDatabase } from "@waverti/database/testing";
import { runMaintenance } from "../src/jobs/maintenance";
import type { WorkerContext } from "../src/context";

let t: TestDatabase;
beforeAll(async () => {
  t = await createTestDatabase();
});
afterAll(async () => {
  await t?.drop();
});

const TABLES = ["users", "profiles", "email_outbox", "notifications", "monitoring_tasks", "monitoring_jobs", "monitoring_results", "monitoring_seen_items", "search_cache", "app_settings", "plans"];

async function snapshot(): Promise<Record<string, { n: number; digest: string }>> {
  const out: Record<string, { n: number; digest: string }> = {};
  for (const tb of TABLES) {
    const r = await t.client.unsafe(`select count(*)::int as n, coalesce(md5(string_agg(x::text, '|' order by x::text)), '') as digest from public."${tb}" x`);
    out[tb] = { n: Number(r[0]!.n), digest: String(r[0]!.digest) };
  }
  return out;
}

describe("maintenance : aucune donnée existante n'est effacée ni réécrite", () => {
  it("3 comptes, 4 e-mails de confirmation, alertes et caches Brave intacts après la maintenance (droits « none »)", async () => {
    const users = [await createTestUser(t), await createTestUser(t), await createTestUser(t)];
    for (const [i, u] of users.entries()) {
      await t.client`insert into email_outbox (user_id, to_email, template, subject, payload, status) values (${u.id}, ${"c" + i + "@example.test"}, 'confirm_email', 'Confirmez votre adresse', '{"link":"https://x.test/c"}'::jsonb, 'sent')`;
    }
    await t.client`insert into email_outbox (user_id, to_email, template, subject, payload, status) values (${users[0]!.id}, 'c0@example.test', 'confirm_email', 'Confirmez votre adresse (renvoi)', '{"link":"https://x.test/c2"}'::jsonb, 'sent')`;
    const [task] = await t.client<{ id: string }[]>`insert into monitoring_tasks (user_id, kind, name, condition) values (${users[0]!.id}, 'web_topic', 'sujet', '{}'::jsonb) returning id`;
    await t.client`insert into monitoring_seen_items (task_id, user_id, fingerprint, url, title, classification) values (${task!.id}, ${users[0]!.id}, ${"f".repeat(40)}, 'https://editeur.example/a', 'Titre', 'confirmed')`;
    await t.client`insert into notifications (user_id, type, title, body, task_id, source_url) values (${users[0]!.id}, 'web_topic', 'Confirmé : Aurora', 'Source', ${task!.id}, 'https://editeur.example/a')`;
    await t.client`insert into search_cache (query_hash, provider, query, results, expires_at) values ('h-keep', 'brave', 'requête', '[]'::jsonb, now() + interval '1 hour')`;

    const before = await snapshot();
    expect(before.users!.n).toBeGreaterThanOrEqual(3);
    expect(before.email_outbox!.n).toBe(4);

    delete process.env.WAVERTI_BRAVE_STORAGE_RIGHTS;
    await runMaintenance({ db: t.db, config: {}, counters: { succeeded: 0, failed: 0 } } as unknown as WorkerContext);

    expect(await snapshot()).toEqual(before);
  });
});

describe("séparation migrations / déploiement", () => {
  const root = resolve(__dirname, "../../..");
  it("le build web n'exécute aucune migration ni script de base de données", () => {
    const pkg = JSON.parse(readFileSync(resolve(root, "apps/web/package.json"), "utf8")) as { scripts: Record<string, string> };
    expect(pkg.scripts.build).toBe("next build");
    for (const [name, cmd] of Object.entries(pkg.scripts)) expect(`${name}: ${cmd}`).not.toMatch(/migrat|db:|seed|reset/i);
  });
  it("le build racine (turbo) et turbo.json ne déclenchent pas de migration", () => {
    const turbo = readFileSync(resolve(root, "turbo.json"), "utf8");
    expect(turbo).not.toMatch(/migrat|db:/i);
  });
  it("l'outil de remise à zéro et la neutralisation Brave exigent une variable d'autorisation explicite", () => {
    expect(readFileSync(resolve(root, "packages/database/scripts/reset-data.ts"), "utf8")).toContain("WAVERTI_ALLOW_DESTRUCTIVE_RESET");
    expect(readFileSync(resolve(root, "packages/monitoring/scripts/brave-enforce.ts"), "utf8")).toContain("WAVERTI_ALLOW_DESTRUCTIVE_ENFORCE");
  });
  it("la maintenance n'appelle plus la neutralisation autrement qu'en simulation (dryRun)", () => {
    const src = readFileSync(resolve(root, "apps/worker/src/jobs/maintenance.ts"), "utf8");
    expect(src).toMatch(/enforceBraveStoragePolicy\(ctx\.db, "none", \{ dryRun: true \}\)/);
    expect(src.match(/enforceBraveStoragePolicy\(/g)?.length).toBe(1);
  });
});
