import {
  agentDevices,
  businessEndpoints,
  businessSites,
  eq,
  incidents,
  monitoringResults,
  monitoringSchedules,
  monitoringTargets,
  monitoringTasks,
  notifications,
  profiles,
  subscriptions,
  supportMessages,
  supportTickets,
  withUser,
  browserTestScenarios,
} from "@watchly/database";
import { withActor } from "@/lib/api";
import { getDb } from "@/lib/db";

/** Export RGPD (droit d'accès / portabilité) : données du compte au format JSON, lues sous RLS. */
export const GET = withActor(
  async (_req, actor) => {
    const data = await withUser(getDb(), actor.userId, async (tx) => {
      const [profile] = await tx
        .select({
          email: profiles.email,
          displayName: profiles.displayName,
          locale: profiles.locale,
          timezone: profiles.timezone,
          notifyEmail: profiles.notifyEmail,
          notifyInapp: profiles.notifyInapp,
          notifyDesktop: profiles.notifyDesktop,
          marketingOptIn: profiles.marketingOptIn,
          createdAt: profiles.createdAt,
        })
        .from(profiles)
        .where(eq(profiles.id, actor.userId));
      return {
        exportedAt: new Date().toISOString(),
        profile,
        subscriptions: await tx
          .select({ planId: subscriptions.planId, status: subscriptions.status, trialEnd: subscriptions.trialEnd, currentPeriodEnd: subscriptions.currentPeriodEnd, createdAt: subscriptions.createdAt })
          .from(subscriptions),
        monitors: await tx.select().from(monitoringTasks),
        targets: await tx.select().from(monitoringTargets),
        schedules: await tx.select().from(monitoringSchedules),
        results: await tx.select().from(monitoringResults).limit(20_000),
        notifications: await tx.select().from(notifications).limit(20_000),
        devices: await tx
          .select({ name: agentDevices.name, platform: agentDevices.platform, status: agentDevices.status, consentLocalAt: agentDevices.consentLocalAt, lastSeenAt: agentDevices.lastSeenAt, createdAt: agentDevices.createdAt })
          .from(agentDevices),
        businessSites: await tx.select({ name: businessSites.name, domain: businessSites.domain, status: businessSites.status, verifiedAt: businessSites.verifiedAt }).from(businessSites),
        businessEndpoints: await tx.select({ name: businessEndpoints.name, url: businessEndpoints.url }).from(businessEndpoints),
        scenarios: await tx.select({ name: browserTestScenarios.name, startUrl: browserTestScenarios.startUrl, steps: browserTestScenarios.steps }).from(browserTestScenarios),
        incidents: await tx.select().from(incidents).limit(5000),
        supportTickets: await tx.select().from(supportTickets),
        supportMessages: await tx.select().from(supportMessages),
      };
    });
    return new Response(JSON.stringify(data, null, 2), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="watchly-export-${new Date().toISOString().slice(0, 10)}.json"`,
        "cache-control": "no-store",
      },
    });
  },
  { rate: { name: "export", limit: 5, windowSec: 3600 } },
);
