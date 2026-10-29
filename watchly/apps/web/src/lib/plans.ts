import "server-only";
import { unstable_cache } from "next/cache";
import { asc, eq, plans as plansTable } from "@watchly/database";
import { PLAN_CATALOG, type PlanDefinition, type PlanId } from "@watchly/billing/catalog";
import { getDb, isDatabaseConfigured } from "./db";

const loadPlans = unstable_cache(
  async (): Promise<PlanDefinition[] | null> => {
    if (!isDatabaseConfigured()) return null;
    try {
      const rows = await getDb().select().from(plansTable).where(eq(plansTable.isPublic, true)).orderBy(asc(plansTable.sortOrder));
      return rows.map((r) => ({
        id: r.id as PlanId,
        name: r.name,
        description: r.description,
        priceCents: r.priceCents,
        trialHours: r.trialHours,
        sortOrder: r.sortOrder,
        maxMonitors: r.maxMonitors,
        maxWebTopics: r.maxWebTopics,
        pageIntervalMinutes: r.pageIntervalMinutes,
        webIntervalMinutes: r.webIntervalMinutes,
        cloudRelay: r.cloudRelay,
        emailAlerts: r.emailAlerts,
        historyDays: r.historyDays,
        advancedHistory: r.advancedHistory,
        dataExports: r.dataExports,
        monthlySearchCalls: r.monthlySearchCalls,
        businessSitesIncluded: r.businessSitesIncluded,
        businessEndpointsPerSite: r.businessEndpointsPerSite,
        businessHttpIntervalSeconds: r.businessHttpIntervalSeconds,
        businessScenariosPerSite: r.businessScenariosPerSite,
        businessScenarioIntervalMinutes: r.businessScenarioIntervalMinutes,
        businessTlsChecks: r.businessTlsChecks,
        priorityAlerts: r.priorityAlerts,
        trialMaxMonitors: r.trialMaxMonitors,
        trialMaxWebTopics: r.trialMaxWebTopics,
        trialMaxBusinessSites: r.trialMaxBusinessSites,
        trialDailySearchCalls: r.trialDailySearchCalls,
      }));
    } catch (err) {
      console.error("plans: lecture impossible, repli sur le catalogue", (err as Error).message);
      return null;
    }
  },
  ["public-plans"],
  { revalidate: 3600, tags: ["plans"] },
);

/** Formules publiques : base de données (paramétrable) avec repli sur le catalogue intégré. */
export async function getPublicPlans(): Promise<PlanDefinition[]> {
  const fromDb = await loadPlans();
  if (fromDb && fromDb.length) return fromDb;
  return Object.values(PLAN_CATALOG).sort((a, b) => a.sortOrder - b.sortOrder);
}
