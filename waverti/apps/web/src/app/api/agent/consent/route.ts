import { z } from "zod";
import { agentDevices, eq } from "@waverti/database";
import { LOCAL_CONSENT_VERSION } from "@waverti/config/constants";
import { apiError, readJson } from "@/lib/api";
import { noStore, withDevice } from "@/lib/agent";
import { getDb } from "@/lib/db";

/** Acceptation explicite (ou retrait) du fonctionnement local, horodatée et versionnée. */
export const POST = withDevice(async (req, device) => {
  const body = await readJson(req, z.object({ accepted: z.boolean(), consentVersion: z.string().max(40) }));
  if (!body.ok) return body.res;
  if (body.data.accepted && body.data.consentVersion !== LOCAL_CONSENT_VERSION) {
    return apiError(409, "consent_outdated", "Le texte d'acceptation a changé : mettez à jour l'application.");
  }
  await getDb()
    .update(agentDevices)
    .set(
      body.data.accepted
        ? { consentLocalAt: new Date(), consentVersion: body.data.consentVersion, monitoringEnabled: true }
        : { consentLocalAt: null, consentVersion: null, monitoringEnabled: false },
    )
    .where(eq(agentDevices.id, device.deviceId));
  return noStore({ ok: true, monitoringEnabled: body.data.accepted });
});
