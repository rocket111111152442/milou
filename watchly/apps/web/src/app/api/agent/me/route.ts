import { agentDevices, eq, plans, profiles } from "@watchly/database";
import { getEntitlements } from "@watchly/billing";
import { LOCAL_CONSENT_TEXT, LOCAL_CONSENT_VERSION } from "@watchly/config/constants";
import { noStore, withDevice } from "@/lib/agent";
import { getDb } from "@/lib/db";

export const GET = withDevice(async (_req, device) => {
  const db = getDb();
  const [p] = await db.select({ email: profiles.email, displayName: profiles.displayName }).from(profiles).where(eq(profiles.id, device.userId));
  const [d] = await db
    .select({ id: agentDevices.id, name: agentDevices.name, platform: agentDevices.platform, consentLocalAt: agentDevices.consentLocalAt, consentVersion: agentDevices.consentVersion, monitoringEnabled: agentDevices.monitoringEnabled })
    .from(agentDevices)
    .where(eq(agentDevices.id, device.deviceId));
  const ent = await getEntitlements(db, device.userId);
  const [plan] = await db.select({ name: plans.name }).from(plans).where(eq(plans.id, ent.planId));
  return noStore({
    user: { email: p?.email ?? "", displayName: p?.displayName ?? null },
    device: d,
    plan: { id: ent.planId, name: plan?.name ?? ent.planId, cloudRelay: ent.cloudRelay, maxMonitors: ent.maxMonitors, pageIntervalMinutes: ent.pageIntervalMinutes, isTrial: ent.source === "trial" },
    consent: { version: LOCAL_CONSENT_VERSION, text: LOCAL_CONSENT_TEXT, accepted: Boolean(d?.consentLocalAt) && d?.consentVersion === LOCAL_CONSENT_VERSION },
  });
});
