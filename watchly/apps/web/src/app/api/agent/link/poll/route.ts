import { newDeviceToken, sha256Hex } from "@watchly/auth";
import { agentDevices, agentLinkRequests, and, eq, sql } from "@watchly/database";
import { linkPollSchema } from "@watchly/types";
import { apiError, handleApiError, readJson } from "@/lib/api";
import { noStore } from "@/lib/agent";
import { getDb, isDatabaseConfigured } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";

/** Étape 3 : l'application interroge ; après approbation, un jeton d'appareil est émis UNE seule fois. */
export async function POST(req: Request) {
  try {
    if (!isDatabaseConfigured()) return apiError(503, "not_configured");
    const body = await readJson(req, linkPollSchema);
    if (!body.ok) return body.res;
    const hash = sha256Hex(body.data.deviceCode);
    const rl = await rateLimit(`link-poll:${hash.slice(0, 24)}`, 30, 300);
    if (!rl.ok) return noStore({ status: "slow_down" }, 429);
    const db = getDb();
    const result = await db.transaction(async (tx) => {
      const [r] = await tx.select().from(agentLinkRequests).where(eq(agentLinkRequests.deviceCodeHash, hash)).for("update").limit(1);
      if (!r) return { status: "invalid" as const };
      await tx.update(agentLinkRequests).set({ lastPolledAt: new Date() }).where(eq(agentLinkRequests.id, r.id));
      if (r.status === "pending" && r.expiresAt.getTime() < Date.now()) {
        await tx.update(agentLinkRequests).set({ status: "expired" }).where(eq(agentLinkRequests.id, r.id));
        return { status: "expired" as const };
      }
      if (r.status !== "approved" || !r.userId) return { status: r.status };
      const { token, hash: tokenHash } = newDeviceToken();
      const [device] = await tx
        .insert(agentDevices)
        .values({ userId: r.userId, name: r.deviceName, platform: r.platform, appVersion: r.appVersion, tokenHash, status: "active", monitoringEnabled: false })
        .returning({ id: agentDevices.id });
      const consumed = await tx
        .update(agentLinkRequests)
        .set({ status: "consumed", deviceId: device!.id })
        .where(and(eq(agentLinkRequests.id, r.id), eq(agentLinkRequests.status, "approved")))
        .returning({ id: agentLinkRequests.id });
      if (!consumed.length) throw new Error("link already consumed");
      await tx.execute(sql`select 1`);
      return { status: "approved" as const, deviceToken: token, deviceId: device!.id };
    });
    return noStore(result, result.status === "invalid" ? 404 : 200);
  } catch (err) {
    return handleApiError(err);
  }
}
