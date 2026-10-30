import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { apiUsage, eq, sql } from "@waverti/database";
import { createTestDatabase, createTestUser, type TestDatabase } from "@waverti/database/testing";
import type { SearchProvider, SearchResultItem } from "../src/search/brave";
import { BudgetExceededError, runWebTopic, type WebRunDeps } from "../src/search/engine";

let t: TestDatabase;
beforeAll(async () => {
  t = await createTestDatabase();
});
afterAll(async () => {
  await t?.drop();
});

function fakeProvider(results: SearchResultItem[]): SearchProvider & { calls: number; set(r: SearchResultItem[]): void } {
  let current = results;
  return {
    name: "fake",
    calls: 0,
    set(r) {
      current = r;
    },
    async search() {
      this.calls++;
      return current;
    },
  };
}

const r = (hostname: string, title: string, description = ""): SearchResultItem => ({ url: `https://${hostname}/${encodeURIComponent(title)}`, title, description, age: null, publishedAt: null, hostname });
const condition = { type: "web_topic" as const, intent: "release_date" as const, subject: "Projet Aurora", keywords: [], requireOfficial: true };

async function task(userId: string, over: Record<string, unknown> = {}) {
  const [row] = await t.client<{ id: string }[]>`
    insert into monitoring_tasks (user_id, kind, name, condition) values (${userId}, 'web_topic', 'Aurora', ${JSON.stringify(condition)}::jsonb) returning id`;
  return { id: row!.id, userId, name: "Aurora", condition, queries: ['"Projet Aurora" date de sortie officielle'], officialDomains: ["editeur.example"], runIndex: 0, ...over };
}

describe("web topic engine", () => {
  it("only alerts on official confirmation when required, and never twice for the same information", async () => {
    const u = await createTestUser(t);
    const provider = fakeProvider([r("forum-jeux.example", "Projet Aurora le 14 mars 2027 ?"), r("numerama.com", "Projet Aurora : sortie en mars 2027", "Le studio vise mars 2027")]);
    const deps: WebRunDeps = { db: t.db, provider, planId: "pro", monthlyCallLimit: 100, dailyCallLimit: null };
    const tk = await task(u.id);
    const first = await runWebTopic(deps, tk);
    expect(first.observation.status).toBe("probable");
    expect(first.evaluation.triggered).toBe(false);

    provider.set([r("editeur.example", "Projet Aurora sortira le 14 mars 2027", "Communiqué officiel"), r("numerama.com", "Projet Aurora : sortie en mars 2027", "Le studio vise mars 2027")]);
    await t.db.execute(sql`delete from search_cache`);
    const second = await runWebTopic(deps, tk);
    expect(second.evaluation.triggered).toBe(true);
    expect(second.evaluation.alert?.title).toMatch(/^Confirmé/);
    expect(second.evaluation.changeSummary?.sourceUrl).toContain("editeur.example");

    await t.db.execute(sql`delete from search_cache`);
    const third = await runWebTopic(deps, tk);
    expect(third.evaluation.triggered).toBe(false);
  });

  it("shares identical public searches across users (one paid call)", async () => {
    const a = await createTestUser(t);
    const b = await createTestUser(t);
    const provider = fakeProvider([r("numerama.com", "Projet Aurora en mars 2027", "Le studio vise mars 2027")]);
    const depsA: WebRunDeps = { db: t.db, provider, planId: "pro", monthlyCallLimit: 100, dailyCallLimit: null };
    await runWebTopic(depsA, await task(a.id, { queries: ["requete partagee aurora"] }));
    await runWebTopic({ ...depsA }, await task(b.id, { queries: ["Requete   PARTAGEE aurora"] }));
    expect(provider.calls).toBe(1);
    const usage = await t.db.select().from(apiUsage).where(eq(apiUsage.userId, b.id));
    expect(usage).toHaveLength(1);
    expect(usage[0]).toMatchObject({ cacheHit: true, estimatedCostMicros: 0 });
  });

  it("enforces per-user and global budgets", async () => {
    const u = await createTestUser(t);
    const provider = fakeProvider([]);
    const deps: WebRunDeps = { db: t.db, provider, planId: "plus", monthlyCallLimit: 1, dailyCallLimit: null };
    await runWebTopic(deps, await task(u.id, { queries: ["budget q1"] }));
    await expect(runWebTopic(deps, await task(u.id, { queries: ["budget q2"] }))).rejects.toBeInstanceOf(BudgetExceededError);

    const trial = await createTestUser(t);
    const trialDeps: WebRunDeps = { db: t.db, provider, planId: "pro", monthlyCallLimit: 100, dailyCallLimit: 1 };
    await runWebTopic(trialDeps, await task(trial.id, { queries: ["trial q1"] }));
    await expect(runWebTopic(trialDeps, await task(trial.id, { queries: ["trial q2"] }))).rejects.toMatchObject({ scope: "user_day" });

    await t.db.execute(sql`update app_settings set value = '0'::jsonb where key = 'budget.monthly_api_eur'`);
    const other = await createTestUser(t);
    await expect(runWebTopic({ ...deps, monthlyCallLimit: 100 }, await task(other.id, { queries: ["global q"] }))).rejects.toMatchObject({ scope: "global" });
    await t.db.execute(sql`update app_settings set value = '50'::jsonb where key = 'budget.monthly_api_eur'`);
  });

  it("never exceeds the monthly quota under concurrency, and refunds failed API calls", async () => {
    const u = await createTestUser(t);
    const provider = fakeProvider([]);
    const deps: WebRunDeps = { db: t.db, provider, planId: "plus", monthlyCallLimit: 5, dailyCallLimit: null };
    const tasks = await Promise.all(Array.from({ length: 20 }, (_, i) => task(u.id, { queries: [`concurrent q${i}`] })));
    const results = await Promise.allSettled(tasks.map((tk) => runWebTopic(deps, tk)));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(5);
    expect(provider.calls).toBe(5);
    const [c] = await t.client<{ value: string }[]>`select value from usage_counters where user_id = ${u.id} and metric = 'brave_search' and length(period) = 7`;
    expect(Number(c!.value)).toBe(5);

    // Un appel qui échoue chez le fournisseur n'est pas décompté.
    const v = await createTestUser(t);
    const failing: SearchProvider = { name: "fake", async search() { throw new Error("réseau"); } };
    await expect(runWebTopic({ ...deps, provider: failing }, await task(v.id, { queries: ["failing q"] }))).rejects.toThrow(/réseau/);
    const [d] = await t.client<{ value: string }[]>`select value from usage_counters where user_id = ${v.id} and metric = 'brave_search' and length(period) = 7`;
    expect(Number(d?.value ?? 0)).toBe(0);
  });

  it("fails clearly when no search provider is configured", async () => {
    const u = await createTestUser(t);
    await expect(runWebTopic({ db: t.db, provider: null, planId: "pro", monthlyCallLimit: 10, dailyCallLimit: null }, await task(u.id, { queries: ["no provider"] }))).rejects.toThrow(/BRAVE_SEARCH_API_KEY/);
  });
});
