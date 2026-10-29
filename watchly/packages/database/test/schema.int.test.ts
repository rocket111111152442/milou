import { getTableColumns, getTableName, is } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as schema from "../src/schema";
import { createTestDatabase, createTestUser, type TestDatabase } from "../src/testing";
import { listMigrations } from "../src/migrations";

let t: TestDatabase;

beforeAll(async () => {
  t = await createTestDatabase();
});
afterAll(async () => {
  await t?.drop();
});

describe("migrations", () => {
  it("are all applied and tracked like the Supabase CLI", async () => {
    const rows = await t.client<{ version: string }[]>`select version from supabase_migrations.schema_migrations order by version`;
    expect(rows.map((r) => r.version)).toEqual(listMigrations().map((m) => m.version));
  });

  it("drizzle schema matches the database (every table and column exists)", async () => {
    const cols = await t.client<{ table_schema: string; table_name: string; column_name: string }[]>`
      select table_schema, table_name, column_name from information_schema.columns
      where table_schema in ('public', 'auth')`;
    const existing = new Set(cols.map((c) => `${c.table_schema}.${c.table_name}.${c.column_name}`));
    const missing: string[] = [];
    for (const value of Object.values(schema)) {
      if (!is(value, PgTable)) continue;
      const name = getTableName(value);
      const schemaName = name === "users" ? "auth" : "public";
      for (const col of Object.values(getTableColumns(value))) {
        const key = `${schemaName}.${name}.${col.name}`;
        if (!existing.has(key)) missing.push(key);
      }
    }
    expect(missing).toEqual([]);
  });

  it("enables RLS on every public table", async () => {
    const rows = await t.client<{ relname: string }[]>`
      select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`;
    expect(rows.map((r) => r.relname)).toEqual([]);
  });

  it("seeds the four commercial plans with server-side quotas", async () => {
    const rows = await t.client<{ id: string; price_cents: number; max_monitors: number }[]>`
      select id, price_cents, max_monitors from plans order by sort_order`;
    expect(rows).toEqual([
      { id: "discovery", price_cents: 0, max_monitors: 3 },
      { id: "plus", price_cents: 599, max_monitors: 20 },
      { id: "pro", price_cents: 1499, max_monitors: 100 },
      { id: "business", price_cents: 3999, max_monitors: 100 },
    ]);
  });

  it("creates a profile when an auth user is created", async () => {
    const u = await createTestUser(t, "Hello@Example.test");
    const [p] = await t.client`select email, role from profiles where id = ${u.id}`;
    expect(p).toMatchObject({ email: "Hello@Example.test", role: "user" });
  });
});
