import { sql, type Database } from "@waverti/database";

/** Lit un réglage numérique de la plateforme (table app_settings) ; `fallback` s'il est absent ou illisible. */
export async function settingNumber(db: Database, key: string, fallback: number): Promise<number> {
  const r = await db.execute<{ value: unknown }>(sql`select value from app_settings where key = ${key}`);
  const v = Number(r[0]?.value);
  return Number.isFinite(v) ? v : fallback;
}

/** Réglages des appels Brave (modifiables sans déploiement par un administrateur). */
export const BRAVE_SETTINGS = {
  /** Plafond mensuel global de dépense Brave, en dollars. Valeur initiale : 50 $. */
  monthlyBudgetUsd: { key: "budget.brave_monthly_usd", fallback: 50 },
  /** Coût estimé d'un appel, en micro-dollars (5 000 = 0,005 $ = 5 $ pour 1 000 appels). À vérifier sur le plan Brave souscrit. */
  requestCostUsdMicros: { key: "cost.brave_request_usd_micros", fallback: 5000 },
} as const;

export interface BraveGlobalCap {
  budgetUsd: number;
  costMicros: number;
  /** Nombre maximal d'appels Brave par mois civil UTC, tous usages confondus. */
  maxRequests: number;
}

export async function loadBraveGlobalCap(db: Database): Promise<BraveGlobalCap> {
  const budgetUsd = Math.max(0, await settingNumber(db, BRAVE_SETTINGS.monthlyBudgetUsd.key, BRAVE_SETTINGS.monthlyBudgetUsd.fallback));
  const costMicros = Math.max(1, await settingNumber(db, BRAVE_SETTINGS.requestCostUsdMicros.key, BRAVE_SETTINGS.requestCostUsdMicros.fallback));
  return { budgetUsd, costMicros, maxRequests: Math.floor((budgetUsd * 1_000_000) / costMicros) };
}
