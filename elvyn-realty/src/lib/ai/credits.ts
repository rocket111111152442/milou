import "server-only";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { env } from "@/config/env";
import { getDb, schema } from "@/lib/db";

/**
 * Assistant credit, kept in USD of AI usage internally. The CRM only shows a percentage
 * ("tokens left") and an estimated number of messages.
 */
export interface CreditStatus {
  percentLeft: number; // 0–100, relative to the balance right after the last top-up
  exhausted: boolean;
  estimatedMessagesLeft: number | null;
  lastTopUpAt: string | null;
}

async function ensureInitialCredit() {
  if (!(env.ai.initialCreditUsd > 0)) return;
  const db = await getDb();
  await db
    .insert(schema.aiCredits)
    .values({ kind: "initial", amountUsd: env.ai.initialCreditUsd, externalId: "initial" })
    .onConflictDoNothing({ target: schema.aiCredits.externalId });
}

async function spentSince(since: Date | null): Promise<number> {
  const db = await getDb();
  const [r] = await db
    .select({ s: sql<number>`coalesce(sum(${schema.aiUsage.costUsd}),0)` })
    .from(schema.aiUsage)
    .where(since ? gte(schema.aiUsage.createdAt, since) : undefined);
  return Number(r?.s ?? 0);
}

export async function creditStatus(): Promise<CreditStatus> {
  await ensureInitialCredit();
  const db = await getDb();
  const credits = await db.select().from(schema.aiCredits).orderBy(desc(schema.aiCredits.createdAt));
  const totalCredits = credits.reduce((a, c) => a + c.amountUsd, 0);
  const balance = totalCredits - (await spentSince(null));
  // Reference = balance right after the most recent credit event (so a fresh top-up shows 100 %).
  const last = credits[0] ?? null;
  const spentAfterLast = last ? await spentSince(last.createdAt) : 0;
  const reference = balance + spentAfterLast;
  const percentLeft = reference > 0 ? Math.max(0, Math.min(100, (balance / reference) * 100)) : 0;

  // Average cost of a visitor message over the last 30 days (fallback: 5 US cents).
  const since = new Date(Date.now() - 30 * 86400_000);
  const [turns] = await db
    .select({ n: sql<number>`count(*)` })
    .from(schema.aiUsage)
    .where(and(eq(schema.aiUsage.outcome, "turn"), gte(schema.aiUsage.createdAt, since)));
  const spent30 = await spentSince(since);
  const avg = Number(turns?.n ?? 0) >= 5 ? spent30 / Number(turns.n) : 0.05;
  return {
    percentLeft: Math.round(percentLeft),
    exhausted: balance <= 0,
    estimatedMessagesLeft: balance > 0 && avg > 0 ? Math.floor(balance / avg) : 0,
    lastTopUpAt: last?.createdAt ? new Date(last.createdAt).toISOString() : null,
  };
}

/** Records a paid top-up once (idempotent on the Stripe session id). Returns false if already recorded. */
export async function addPurchasedCredit(sessionId: string, paidAmount: number, currency: string): Promise<boolean> {
  const db = await getDb();
  const rows = await db
    .insert(schema.aiCredits)
    .values({ kind: "purchase", amountUsd: Math.round(paidAmount * env.ai.creditShare * 100) / 100, paidAmount, paidCurrency: currency.toUpperCase(), externalId: sessionId })
    .onConflictDoNothing({ target: schema.aiCredits.externalId })
    .returning({ id: schema.aiCredits.id });
  return rows.length > 0;
}

export async function purchaseHistory() {
  const db = await getDb();
  return db
    .select({ id: schema.aiCredits.id, paidAmount: schema.aiCredits.paidAmount, paidCurrency: schema.aiCredits.paidCurrency, createdAt: schema.aiCredits.createdAt })
    .from(schema.aiCredits)
    .where(eq(schema.aiCredits.kind, "purchase"))
    .orderBy(desc(schema.aiCredits.createdAt))
    .limit(50);
}
