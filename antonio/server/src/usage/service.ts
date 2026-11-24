import { and, eq, gte, sql } from "drizzle-orm";
import { config } from "../config.js";
import { db, schema } from "../db/client.js";
import { publish } from "../realtime/hub.js";
import { billingEnabled, paidOffer } from "../billing/service.js";

/**
 * Consommation mesurée séparément : modèle texte, minutes vocales, traitement
 * documentaire, outils payants, tâches de fond. Coûts estimés en micro-dollars
 * à partir des tarifs configurés (et non des estimations d'un chatbot texte).
 */
export type UsageKind = "text_model" | "voice" | "documents" | "paid_tool" | "background";

export async function recordUsage(r: {
  orgId: string;
  userId: string | null;
  kind: UsageKind;
  model?: string | null;
  quantity: number;
  unit: string;
  costMicros: number;
  meta?: Record<string, unknown>;
}) {
  await db()
    .insert(schema.usageRecords)
    .values({ ...r, model: r.model ?? null, meta: r.meta ?? {} });
  if (r.costMicros > 0) await maybeAlert(r.orgId, r.userId);
}

export function textCostMicros(inputTokens: number, cachedTokens: number, outputTokens: number): number {
  const c = config();
  const uncached = Math.max(0, inputTokens - cachedTokens);
  return Math.round(uncached * c.PRICE_TEXT_INPUT_PER_M + cachedTokens * c.PRICE_TEXT_CACHED_INPUT_PER_M + outputTokens * c.PRICE_TEXT_OUTPUT_PER_M);
}

/** GPT-Live facture à la seconde ; on compte prudemment tout au tarif « actif ». */
export function voiceCostMicros(seconds: number): number {
  return Math.round((seconds / 60) * config().PRICE_LIVE_ACTIVE_PER_MIN * 1_000_000);
}

export interface BudgetRow {
  monthlyLimitMicros: number;
  voiceMinutesDaily: number;
  voiceSessionMaxMinutes: number;
  actionsDaily: number;
  agentStepsPerTurn: number;
  alertThresholdPct: number;
}

const DEFAULT_BUDGET: BudgetRow = {
  monthlyLimitMicros: 20_000_000,
  voiceMinutesDaily: 60,
  voiceSessionMaxMinutes: 15,
  actionsDaily: 100,
  agentStepsPerTurn: 8,
  alertThresholdPct: 80,
};

export async function getBudget(scopeType: "org" | "user", scopeId: string): Promise<BudgetRow> {
  const [row] = await db()
    .select()
    .from(schema.budgets)
    .where(and(eq(schema.budgets.scopeType, scopeType), eq(schema.budgets.scopeId, scopeId)));
  return row ?? DEFAULT_BUDGET;
}

/** Limites effectives : la plus restrictive entre l'utilisateur et l'organisation. */
export async function effectiveBudget(orgId: string, userId: string): Promise<BudgetRow & { orgMonthlyLimitMicros: number }> {
  const [org, user] = await Promise.all([getBudget("org", orgId), getBudget("user", userId)]);
  const plan = billingEnabled() ? await paidOffer(userId) : null;
  return {
    monthlyLimitMicros: Math.min(org.monthlyLimitMicros, user.monthlyLimitMicros, plan?.aiBudgetMicros ?? Infinity),
    orgMonthlyLimitMicros: org.monthlyLimitMicros,
    voiceMinutesDaily: Math.min(org.voiceMinutesDaily, user.voiceMinutesDaily),
    voiceSessionMaxMinutes: Math.min(org.voiceSessionMaxMinutes, user.voiceSessionMaxMinutes),
    actionsDaily: Math.min(org.actionsDaily, user.actionsDaily),
    agentStepsPerTurn: Math.min(org.agentStepsPerTurn, user.agentStepsPerTurn),
    alertThresholdPct: Math.min(org.alertThresholdPct, user.alertThresholdPct),
  };
}

export async function setBudget(scopeType: "org" | "user", scopeId: string, values: Partial<BudgetRow>) {
  const current = await getBudget(scopeType, scopeId);
  await db()
    .insert(schema.budgets)
    .values({ scopeType, scopeId, ...current, ...values })
    .onConflictDoUpdate({ target: [schema.budgets.scopeType, schema.budgets.scopeId], set: { ...values, updatedAt: new Date() } });
}

function monthStart() {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}
function dayStart() {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export async function monthCost(orgId: string, userId?: string): Promise<number> {
  const conds = [eq(schema.usageRecords.orgId, orgId), gte(schema.usageRecords.createdAt, monthStart())];
  if (userId) conds.push(eq(schema.usageRecords.userId, userId));
  const [r] = await db()
    .select({ total: sql<string>`coalesce(sum(${schema.usageRecords.costMicros}), 0)` })
    .from(schema.usageRecords)
    .where(and(...conds));
  return Number(r.total);
}

export async function voiceSecondsToday(userId: string): Promise<number> {
  const [r] = await db()
    .select({ total: sql<string>`coalesce(sum(${schema.usageRecords.quantity}), 0)` })
    .from(schema.usageRecords)
    .where(and(eq(schema.usageRecords.userId, userId), eq(schema.usageRecords.kind, "voice"), gte(schema.usageRecords.createdAt, dayStart())));
  return Number(r.total);
}

export async function budgetStatus(orgId: string, userId: string) {
  const b = await effectiveBudget(orgId, userId);
  const [userMonth, orgMonth, voiceToday] = await Promise.all([monthCost(orgId, userId), monthCost(orgId), voiceSecondsToday(userId)]);
  const exceeded = userMonth >= b.monthlyLimitMicros || orgMonth >= b.orgMonthlyLimitMicros;
  return {
    budget: b,
    userMonthMicros: userMonth,
    orgMonthMicros: orgMonth,
    voiceSecondsToday: voiceToday,
    exceeded,
    voiceExceeded: voiceToday >= b.voiceMinutesDaily * 60,
    ratio: Math.max(userMonth / Math.max(1, b.monthlyLimitMicros), orgMonth / Math.max(1, b.orgMonthlyLimitMicros)),
  };
}

const alerted = new Map<string, number>();
async function maybeAlert(orgId: string, userId: string | null) {
  if (!userId) return;
  const s = await budgetStatus(orgId, userId);
  const level = s.exceeded ? 100 : s.ratio * 100 >= s.budget.alertThresholdPct ? s.budget.alertThresholdPct : 0;
  const key = `${userId}:${new Date().toISOString().slice(0, 7)}`;
  if (level && (alerted.get(key) ?? 0) < level) {
    alerted.set(key, level);
    await publish(userId, {
      type: "usage.alert",
      message: s.exceeded
        ? "Budget mensuel atteint : les fonctions payantes (IA, voix) sont suspendues jusqu'au mois prochain ou jusqu'à une hausse du budget."
        : `Vous avez consommé ${Math.round(s.ratio * 100)} % du budget mensuel.`,
    });
  }
}
