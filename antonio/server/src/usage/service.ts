import { and, eq, gte, sql } from "drizzle-orm";
import { config } from "../config.js";
import { db, schema } from "../db/client.js";
import { publish } from "../realtime/hub.js";
import { apiCreditBalance, billingEnabled, paidOffer } from "../billing/service.js";

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
  const userId = r.userId;
  if (userId && r.costMicros > 0 && billingEnabled()) {
    await db().transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext('waverti_credit'), hashtext(${userId}))`);
      const start = monthStart();
      const [spentRow] = await tx.select({ total: sql<string>`coalesce(sum(${schema.usageRecords.costMicros}), 0)` })
        .from(schema.usageRecords).where(and(eq(schema.usageRecords.userId, userId), gte(schema.usageRecords.createdAt, start)));
      const spentBefore = Number(spentRow.total);
      const included = await includedMonthlyLimit(r.orgId, userId);
      const [creditRow] = await tx.select({ balance: sql<string>`coalesce(sum(${schema.apiCreditLedger.amountMicros}), 0)` })
        .from(schema.apiCreditLedger).where(eq(schema.apiCreditLedger.userId, userId));
      const creditBalance = Math.max(0, Number(creditRow.balance));
      await tx.insert(schema.usageRecords).values({ ...r, model: r.model ?? null, meta: r.meta ?? {} });
      const overage = Math.max(0, spentBefore + r.costMicros - Math.max(spentBefore, included));
      const debit = Math.min(creditBalance, overage);
      if (debit > 0) await tx.insert(schema.apiCreditLedger).values({ userId, amountMicros: -debit, kind: "usage" });
    });
  } else {
    await db().insert(schema.usageRecords).values({ ...r, model: r.model ?? null, meta: r.meta ?? {} });
  }
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
  monthlyLimitMicros: 50_000_000,
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
export async function effectiveBudget(orgId: string, userId: string): Promise<BudgetRow & { orgMonthlyLimitMicros: number; baseMonthlyLimitMicros: number; topupBalanceMicros: number }> {
  const [org, user] = await Promise.all([getBudget("org", orgId), getBudget("user", userId)]);
  const plan = billingEnabled() ? await paidOffer(userId) : null;
  const included = Math.min(org.monthlyLimitMicros, user.monthlyLimitMicros, plan?.aiBudgetMicros ?? 20_000_000);
  const [credits, spent] = await Promise.all([apiCreditBalance(userId), monthCost(orgId, userId)]);
  const spentAboveIncluded = Math.max(0, spent - included);
  const monthlyLimitMicros = included + Math.max(0, credits) + spentAboveIncluded;
  const orgIncluded = Math.min(org.monthlyLimitMicros, plan?.aiBudgetMicros ?? 20_000_000);
  return {
    monthlyLimitMicros,
    orgMonthlyLimitMicros: orgIncluded + Math.max(0, credits) + spentAboveIncluded,
    baseMonthlyLimitMicros: included,
    topupBalanceMicros: Math.max(0, credits),
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

async function includedMonthlyLimit(orgId: string, userId: string) {
  const [org, user] = await Promise.all([getBudget("org", orgId), getBudget("user", userId)]);
  const plan = billingEnabled() ? await paidOffer(userId) : null;
  return Math.min(org.monthlyLimitMicros, user.monthlyLimitMicros, plan?.aiBudgetMicros ?? 20_000_000);
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
