import { z } from "zod";
import { agentDevices, eq } from "@watchly/database";
import { apiError, readJson } from "@/lib/api";
import { noStore, withDevice } from "@/lib/agent";
import { getDb } from "@/lib/db";

export const POST = withDevice(async (req, device) => {
  const body = await readJson(req, z.object({ monitoringEnabled: z.boolean() }));
  if (!body.ok) return body.res;
  if (body.data.monitoringEnabled && !device.consentLocalAt) return apiError(403, "consent_required", "Acceptez d'abord le fonctionnement local.");
  await getDb().update(agentDevices).set({ monitoringEnabled: body.data.monitoringEnabled }).where(eq(agentDevices.id, device.deviceId));
  return noStore({ ok: true });
});
