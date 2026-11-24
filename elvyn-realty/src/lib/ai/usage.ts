import "server-only";
import { and, eq, gte, sql } from "drizzle-orm";
import { env } from "@/config/env";
import { getDb, schema } from "@/lib/db";

/** USD per million tokens (Anthropic first-party prices, Nov 2026). Cache writes billed at 1.25× input. */
const PRICES: Record<string, { input: number; output: number; cacheRead: number }> = {
  "claude-opus-5-5": { input: 4, output: 20, cacheRead: 0.2 },
  "claude-sonnet-5-5": { input: 2, output: 10, cacheRead: 0.1 },
  "claude-haiku-5-5": { input: 0.1, output: 0.5, cacheRead: 0.01 },
};

export interface UsageLike {
  input_tokens?: number | null;
  output_tokens?: number | null;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
}

export function estimateCostUsd(model: string, u: UsageLike): number {
  const p = PRICES[model] ?? PRICES["claude-opus-5-5"]; // unknown model: count conservatively
  const inTok = u.input_tokens ?? 0;
  const outTok = u.output_tokens ?? 0;
  const read = u.cache_read_input_tokens ?? 0;
  const write = u.cache_creation_input_tokens ?? 0;
  return (inTok * p.input + outTok * p.output + read * p.cacheRead + write * p.input * 1.25) / 1e6;
}

const today = () => new Date().toISOString().slice(0, 10);
const monthStart = () => new Date().toISOString().slice(0, 8) + "01";

export async function recordUsage(sessionId: string | null, model: string, u: UsageLike, outcome: string) {
  const db = await getDb();
  await db.insert(schema.aiUsage).values({
    day: today(),
    sessionId,
    model,
    inputTokens: u.input_tokens ?? 0,
    outputTokens: u.output_tokens ?? 0,
    cacheReadTokens: u.cache_read_input_tokens ?? 0,
    cacheWriteTokens: u.cache_creation_input_tokens ?? 0,
    costUsd: estimateCostUsd(model, u),
    outcome,
  });
}

export async function usageSummary() {
  const db = await getDb();
  const [month] = await db
    .select({ cost: sql<number>`coalesce(sum(${schema.aiUsage.costUsd}),0)`, calls: sql<number>`count(*)` })
    .from(schema.aiUsage)
    .where(gte(schema.aiUsage.day, monthStart()));
  const [day] = await db
    .select({ calls: sql<number>`count(*)` })
    .from(schema.aiUsage)
    .where(and(eq(schema.aiUsage.day, today()), sql`${schema.aiUsage.outcome} <> 'turn'`));
  const [turnsToday] = await db
    .select({ n: sql<number>`count(*)` })
    .from(schema.aiUsage)
    .where(and(eq(schema.aiUsage.day, today()), eq(schema.aiUsage.outcome, "turn")));
  return {
    monthCostUsd: Number(month?.cost ?? 0),
    monthCalls: Number(month?.calls ?? 0),
    todayCalls: Number(day?.calls ?? 0),
    todayTurns: Number(turnsToday?.n ?? 0),
    budgetUsd: env.ai.monthlyBudgetUsd,
    dailyTurnLimit: env.ai.dailyMessageLimit,
  };
}

/** Returns a reason string when the assistant must switch to fallback mode. */
export async function budgetBlock(): Promise<string | null> {
  const s = await usageSummary();
  if (s.monthCostUsd >= s.budgetUsd) return "monthly_budget";
  if (s.todayTurns >= s.dailyTurnLimit) return "daily_limit";
  return null;
}
