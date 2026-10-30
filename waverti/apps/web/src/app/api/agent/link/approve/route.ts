import { z } from "zod";
import { normalizeUserCode } from "@waverti/auth";
import { agentDevices, agentLinkRequests, and, count, eq, gt } from "@waverti/database";
import { apiError, json, readJson, withActor } from "@/lib/api";
import { MAX_DEVICES_PER_USER } from "@/lib/agent";
import { getDb } from "@/lib/db";

/** Étape 2 : l'utilisateur connecté valide (ou refuse) le code affiché par l'application. */
export const POST = withActor(
  async (req, actor) => {
    const body = await readJson(req, z.object({ userCode: z.string().min(8).max(12), approve: z.boolean() }));
    if (!body.ok) return body.res;
    const code = normalizeUserCode(body.data.userCode);
    if (!code) return apiError(422, "invalid_code", "Code invalide.");
    const db = getDb();
    const [active] = await db.select({ n: count() }).from(agentDevices).where(and(eq(agentDevices.userId, actor.userId), eq(agentDevices.status, "active")));
    if (body.data.approve && (active?.n ?? 0) >= MAX_DEVICES_PER_USER) {
      return apiError(409, "device_limit", `${MAX_DEVICES_PER_USER} appareils maximum : révoquez-en un depuis vos paramètres.`);
    }
    const updated = await db
      .update(agentLinkRequests)
      .set({ status: body.data.approve ? "approved" : "denied", userId: actor.userId, approvedAt: new Date() })
      .where(and(eq(agentLinkRequests.userCode, code), eq(agentLinkRequests.status, "pending"), gt(agentLinkRequests.expiresAt, new Date())))
      .returning({ deviceName: agentLinkRequests.deviceName, platform: agentLinkRequests.platform });
    if (!updated.length) return apiError(404, "code_not_found", "Code introuvable ou expiré. Relancez la liaison depuis l'application.");
    return json({ ok: true, device: updated[0] });
  },
  { rate: { name: "link-approve", limit: 20, windowSec: 3600 } },
);
