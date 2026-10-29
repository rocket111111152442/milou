import { generateUserCode, randomToken, sha256Hex } from "@watchly/auth";
import { agentLinkRequests } from "@watchly/database";
import { linkStartSchema } from "@watchly/types";
import { apiError, handleApiError, readJson } from "@/lib/api";
import { noStore } from "@/lib/agent";
import { getDb, isDatabaseConfigured } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { appUrl, ipFromRequest, ipKey } from "@/lib/request";

const TTL_SECONDS = 600;

/** Étape 1 : l'application demande un code ; l'utilisateur le valide dans son navigateur, connecté. */
export async function POST(req: Request) {
  try {
    if (!isDatabaseConfigured()) return apiError(503, "not_configured");
    const rl = await rateLimit(`link-start:${ipKey(ipFromRequest(req))}`, 10, 3600);
    if (!rl.ok) return apiError(429, "rate_limited", "Trop de demandes de liaison.");
    const body = await readJson(req, linkStartSchema);
    if (!body.ok) return body.res;
    const deviceCode = randomToken(32);
    for (let attempt = 0; attempt < 5; attempt++) {
      const userCode = generateUserCode();
      const inserted = await getDb()
        .insert(agentLinkRequests)
        .values({
          deviceCodeHash: sha256Hex(deviceCode),
          userCode,
          deviceName: body.data.deviceName,
          platform: body.data.platform,
          appVersion: body.data.appVersion ?? null,
          status: "pending",
          expiresAt: new Date(Date.now() + TTL_SECONDS * 1000),
        })
        .onConflictDoNothing()
        .returning({ id: agentLinkRequests.id });
      if (inserted.length) {
        return noStore({
          deviceCode,
          userCode,
          verificationUrl: `${appUrl()}/app/appareils/lier?code=${encodeURIComponent(userCode)}`,
          expiresIn: TTL_SECONDS,
          interval: 5,
        });
      }
    }
    return apiError(503, "busy");
  } catch (err) {
    return handleApiError(err);
  }
}
