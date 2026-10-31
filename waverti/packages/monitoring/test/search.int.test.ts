import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { apiUsage, eq, sql } from "@waverti/database";
import { createTestDatabase, createTestUser, type TestDatabase } from "@waverti/database/testing";
import { createBraveProvider, SearchProviderError, type SearchProvider, type SearchResultItem } from "../src/search/brave";
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

  it("technical counter: every request sent to Brave is logged (success, failure, retry, rate limit, provider quota)", async () => {
    const u = await createTestUser(t);
    let mode: "ok" | "429" | "500" = "ok";
    const fakeFetch = (async () => {
      const headers = { "content-type": "application/json", "x-ratelimit-limit": "1, 2000", "x-ratelimit-remaining": "0, 1987" };
      if (mode === "429") return new Response("{}", { status: 429, headers });
      if (mode === "500") return new Response("{}", { status: 500, headers });
      return new Response(JSON.stringify({ web: { results: [{ url: "https://numerama.com/a", title: "A", description: "" }] } }), { status: 200, headers });
    }) as typeof fetch;
    const provider = createBraveProvider("test-key", "https://brave.invalid", fakeFetch);
    const deps: WebRunDeps = { db: t.db, provider, planId: "pro", monthlyCallLimit: 100, dailyCallLimit: null, quotaPeriod: "bp:2026-10-15" };
    await runWebTopic(deps, await task(u.id, { queries: ["compteur ok"] }));
    mode = "429";
    await expect(runWebTopic({ ...deps, attempt: 1 }, await task(u.id, { queries: ["compteur 429"] }))).rejects.toBeInstanceOf(SearchProviderError);
    mode = "500";
    await expect(runWebTopic({ ...deps, attempt: 2 }, await task(u.id, { queries: ["compteur 500"] }))).rejects.toBeInstanceOf(SearchProviderError);
    const rows = await t.client<{ outcome: string; http_status: number; is_retry: boolean; estimated_cost_micros: string; provider_quota_remaining: number; provider_quota_limit: number }[]>`
      select outcome, http_status, is_retry, estimated_cost_micros::text, provider_quota_remaining, provider_quota_limit
      from provider_requests where user_id = ${u.id} and provider = 'brave_search' order by id`;
    expect(rows.map((r) => [r.outcome, r.http_status, r.is_retry])).toEqual([["success", 200, false], ["rate_limited", 429, false], ["failure", 500, true]]);
    expect(Number(rows[0]!.estimated_cost_micros)).toBeGreaterThan(0);
    expect(rows.slice(1).map((r) => Number(r.estimated_cost_micros))).toEqual([0, 0]);
    expect(rows[0]).toMatchObject({ provider_quota_remaining: 1987, provider_quota_limit: 2000 });
    // Le quota de l'abonné est compté sur la période facturée transmise, et seuls les succès sont décomptés.
    const [c] = await t.client<{ value: string }[]>`select value from usage_counters where user_id = ${u.id} and metric = 'brave_search' and period = 'bp:2026-10-15'`;
    expect(Number(c!.value)).toBe(1);
    const { providerMonthSummary } = await import("@waverti/database");
    const month = new Date().toISOString().slice(0, 7);
    const summary = (await providerMonthSummary(t.db, month)).find((s) => s.provider === "brave_search");
    expect(summary).toMatchObject({ successes: expect.any(Number), rateLimited: expect.any(Number), retries: expect.any(Number) });
    expect(summary!.requests).toBeGreaterThanOrEqual(3);
  });

  it("fails clearly when no search provider is configured", async () => {
    const u = await createTestUser(t);
    await expect(runWebTopic({ db: t.db, provider: null, planId: "pro", monthlyCallLimit: 10, dailyCallLimit: null }, await task(u.id, { queries: ["no provider"] }))).rejects.toThrow(/BRAVE_SEARCH_API_KEY/);
  });
});
