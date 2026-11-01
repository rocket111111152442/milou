import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MIGRATIONS_DIR } from "../src/migrations";
import { createTestDatabase, createTestUser, type TestDatabase } from "../src/testing";

const UP = resolve(MIGRATIONS_DIR, "20261102010000_update_plan_prices.sql");
const DOWN = resolve(MIGRATIONS_DIR, "../rollbacks/20261102010000_update_plan_prices.down.sql");
const OLD = { plus: 599, pro: 1499, max: 2999, business: 3999 };
const NEW = { plus: 999, pro: 1999, max: 2999, business: 4999 };

let t: TestDatabase;
/** Le script de retour arrière porte begin/commit pour un usage manuel dans psql ; le test l'exécute dans la session de test. */
const run = (file: string) => t.client.unsafe(readFileSync(file, "utf8").replace(/^(begin|commit);$/gm, ""));

/** Empreinte de chaque table de `public` (contenu complet) : permet de prouver ce qui a changé, et rien d'autre. */
async function fingerprints(): Promise<Record<string, string>> {
  const tables = await t.client<{ tablename: string }[]>`select tablename from pg_tables where schemaname = 'public' order by 1`;
  const out: Record<string, string> = {};
  for (const { tablename } of tables) {
    const [r] = await t.client.unsafe<{ h: string }[]>(`select md5(coalesce(string_agg(x::text, '|' order by x::text), '')) as h from public."${tablename}" x`);
    out[tablename] = r!.h;
  }
  return out;
}
const prices = async () => Object.fromEntries((await t.client<{ id: string; price_cents: number }[]>`select id, price_cents from plans where id in ('plus','pro','max','business')`).map((r) => [r.id, r.price_cents]));

beforeAll(async () => {
  t = await createTestDatabase();
  // État « avant » : anciens prix (script de retour arrière), puis des données réelles à protéger.
  await run(DOWN);
  const a = await createTestUser(t, "abonne-actif@example.test");
  const b = await createTestUser(t, "abonne-essai@example.test");
  await t.client`insert into subscriptions (user_id, plan_id, stripe_subscription_id, stripe_customer_id, status, current_period_end) values (${a.id}, 'pro', 'sub_test_1', 'cus_test_1', 'active', now() + interval '20 days')`;
  await t.client`insert into subscriptions (user_id, plan_id, stripe_subscription_id, stripe_customer_id, status, trial_end) values (${b.id}, 'plus', 'sub_test_2', 'cus_test_2', 'trialing', now() + interval '2 days')`;
});
afterAll(async () => {
  await t.drop();
});

describe("migration des prix : aucune modification destructive", () => {
  it("le script ne contient que des UPDATE de plans.price_cents (aucun DELETE, DROP, TRUNCATE, ALTER, INSERT)", () => {
    const sql = readFileSync(UP, "utf8").split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
    expect(sql).not.toMatch(/\b(delete|drop|truncate|alter|insert|create|grant|revoke)\b/i);
    const updates = sql.match(/update\s+[\w.]+\s+set\s+[\w]+/gi) ?? [];
    expect(updates).toHaveLength(3);
    for (const u of updates) expect(u.replace(/\s+/g, " ").toLowerCase()).toBe("update public.plans set price_cents");
    expect(sql).toMatch(/where id = 'plus'/);
    expect(sql).not.toMatch(/where id = 'max'/);
  });

  it("état de départ : anciens prix, deux abonnements présents", async () => {
    expect(await prices()).toEqual(OLD);
    const [n] = await t.client`select count(*)::int as n from subscriptions`;
    expect(n!.n).toBe(2);
  });

  it("appliquer la migration ne change que 3 lignes de plans, jamais les abonnements ni les comptes", async () => {
    const before = await fingerprints();
    await run(UP);
    const after = await fingerprints();
    const changed = Object.keys(before).filter((k) => before[k] !== after[k]);
    expect(changed).toEqual(["plans"]);
    expect(await prices()).toEqual(NEW);
    // Max (inchangé) et toutes les autres colonnes de plans sont intactes.
    const [max] = await t.client`select price_cents from plans where id = 'max'`;
    expect(max!.price_cents).toBe(2999);
    const subs = await t.client`select stripe_subscription_id, plan_id, status from subscriptions order by 1`;
    expect(subs.map((s) => [s.stripe_subscription_id, s.plan_id, s.status])).toEqual([["sub_test_1", "pro", "active"], ["sub_test_2", "plus", "trialing"]]);
  });

  it("rejouer la migration est sans effet sur les montants et les autres tables (idempotente ; seul updated_at de plans est réécrit)", async () => {
    const before = await fingerprints();
    await run(UP);
    const after = await fingerprints();
    expect(Object.keys(before).filter((k) => before[k] !== after[k]).every((k) => k === "plans")).toBe(true);
    expect(await prices()).toEqual(NEW);
  });

  it("le retour arrière rétablit exactement l'état initial, abonnements intacts", async () => {
    const withNew = await fingerprints();
    await run(DOWN);
    const back = await fingerprints();
    expect(Object.keys(withNew).filter((k) => withNew[k] !== back[k])).toEqual(["plans"]);
    expect(await prices()).toEqual(OLD);
    const [n] = await t.client`select count(*)::int as n from subscriptions`;
    expect(n!.n).toBe(2);
  });
});
