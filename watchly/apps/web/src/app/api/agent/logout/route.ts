import { agentDevices, eq } from "@watchly/database";
import { noStore, withDevice } from "@/lib/agent";
import { getDb } from "@/lib/db";

/** Déconnexion de l'application : le jeton est révoqué côté serveur. */
export const POST = withDevice(async (_req, device) => {
  await getDb()
    .update(agentDevices)
    .set({ status: "revoked", revokedAt: new Date(), monitoringEnabled: false })
    .where(eq(agentDevices.id, device.deviceId));
  return noStore({ ok: true });
});
