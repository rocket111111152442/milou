import { json, withActor } from "@/lib/api";
import { loadEntitlements } from "@/lib/data/account";
import { getOverview } from "@/lib/data/monitors";

/** Vue d'ensemble (tableau de bord web et application desktop), calculée à partir des données réelles. */
export const GET = withActor(
  async (_req, actor) => {
    const [{ data, cloudRelay }, ent] = await Promise.all([getOverview(actor.userId), loadEntitlements(actor.userId)]);
    return json({
      overview: data,
      cloudRelay,
      entitlements: {
        planId: ent.planId,
        pageIntervalMinutes: ent.pageIntervalMinutes,
        webIntervalMinutes: ent.webIntervalMinutes,
        maxWebTopics: ent.maxWebTopics,
        cloudRelay: ent.cloudRelay,
        emailAlerts: ent.emailAlerts,
      },
    });
  },
  { allowDevice: true },
);
