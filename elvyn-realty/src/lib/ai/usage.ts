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

/**
 * OpenAI prices (USD per million tokens) as published for these models; check
 * https://openai.com/api/pricing and override with AI_PRICE_INPUT/OUTPUT_PER_MTOK if they change.
 * Cached input is counted at 25 % of the input price.
 */
const OPENAI_PRICES: Record<string, { input: number; output: number; cachedFactor?: number }> = {
  // GPT-5.4: $2.50 / $15 per 1M, cached input $0.25 (third-party listings, Nov 2026; confirm on openai.com/api/pricing)
  "gpt-5.4": { input: 2.5, output: 15, cachedFactor: 0.1 },
  "gpt-5.4-mini": { input: 0.75, output: 4.5, cachedFactor: 0.1 },
  "gpt-5.4-nano": { input: 0.2, output: 1.25, cachedFactor: 0.1 },
  "gpt-4.1-mini": { input: 0.4, output: 1.6 },
  "gpt-4.1": { input: 2, output: 8 },
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  "gpt-4o": { input: 2.5, output: 10 },
};

export function estimateCostUsd(model: string, u: UsageLike): number {
  if (env.ai.priceInputPerMTok !== null && env.ai.priceOutputPerMTok !== null) {
    const read = u.cache_read_input_tokens ?? 0;
    return ((u.input_tokens ?? 0) * env.ai.priceInputPerMTok + read * env.ai.priceInputPerMTok * 0.25 + (u.output_tokens ?? 0) * env.ai.priceOutputPerMTok) / 1e6;
  }
  if (!model.startsWith("claude")) {
    // Dated snapshots ("gpt-5.4-mini-2026-03-17") map to the LONGEST matching name, never to a shorter, pricier one.
    const known =
      OPENAI_PRICES[model] ??
      Object.entries(OPENAI_PRICES)
        .filter(([k]) => model.startsWith(k + "-"))
        .sort((a, b) => b[0].length - a[0].length)[0]?.[1];
    const op = known ?? { input: 2.5, output: 15 }; // unknown model: count conservatively
    const read = u.cache_read_input_tokens ?? 0;
    return ((u.input_tokens ?? 0) * op.input + read * op.input * (op.cachedFactor ?? 0.25) + (u.output_tokens ?? 0) * op.output) / 1e6;
  }
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
  if (s.budgetUsd > 0 && s.monthCostUsd >= s.budgetUsd) return "monthly_budget";
  if (s.todayTurns >= s.dailyTurnLimit) return "daily_limit";
  if (env.ai.creditsEnabled) {
    const { creditStatus } = await import("./credits");
    if ((await creditStatus()).exhausted) return "credits_exhausted";
  }
  return null;
}
