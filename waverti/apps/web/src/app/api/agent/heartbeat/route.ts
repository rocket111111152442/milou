import { agentDevices, and, count, eq, notifications, sql } from "@waverti/database";
import { getEntitlements } from "@waverti/billing";
import { heartbeatSchema } from "@waverti/types";
import { readJson } from "@/lib/api";
import { noStore, withDevice } from "@/lib/agent";
import { getDb } from "@/lib/db";

/** Signal de vie de l'application : permet au serveur de savoir si le PC est disponible. */
export const POST = withDevice(
  async (req, device) => {
    const body = await readJson(req, heartbeatSchema);
    if (!body.ok) return body.res;
    const db = getDb();
    await db
      .update(agentDevices)
      .set({ lastSeenAt: new Date(), lastState: body.data.state, appVersion: body.data.appVersion ?? undefined })
      .where(eq(agentDevices.id, device.deviceId));
    // Historique échantillonné (au plus une ligne par minute et par appareil).
    await db.execute(sql`
      insert into agent_heartbeats (device_id, user_id, state, running_jobs, app_version)
      select ${device.deviceId}, ${device.userId}, ${body.data.state}, ${body.data.runningJobs}, ${body.data.appVersion ?? null}
      where not exists (select 1 from agent_heartbeats where device_id = ${device.deviceId} and received_at > now() - interval '60 seconds')`);
    const ent = await getEntitlements(db, device.userId);
    const [pending] = await db
      .select({ n: count() })
      .from(notifications)
      .where(and(eq(notifications.userId, device.userId), eq(notifications.desktopStatus, "pending")));
    return noStore({
      serverTime: new Date().toISOString(),
      monitoringEnabled: device.monitoringEnabled,
      consent: Boolean(device.consentLocalAt),
      plan: { id: ent.planId, cloudRelay: ent.cloudRelay, pageIntervalMinutes: ent.pageIntervalMinutes },
      pendingNotifications: pending?.n ?? 0,
    });
  },
  { rate: { name: "hb", limit: 240, windowSec: 3600 } },
);
