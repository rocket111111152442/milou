import { and, agentDevices, eq, type Database } from "@watchly/database";
import { randomToken, sha256Hex } from "./crypto";

export const DEVICE_TOKEN_PREFIX = "wly_dev_";

export function newDeviceToken(): { token: string; hash: string } {
  const token = `${DEVICE_TOKEN_PREFIX}${randomToken(32)}`;
  return { token, hash: sha256Hex(token) };
}

export interface AuthenticatedDevice {
  deviceId: string;
  userId: string;
  monitoringEnabled: boolean;
  consentLocalAt: Date | null;
}

/** Authentifie un appareil à partir de son jeton Bearer (comparaison par empreinte, jamais en clair). */
export async function authenticateDevice(db: Database, bearer: string | null | undefined): Promise<AuthenticatedDevice | null> {
  if (!bearer || !bearer.startsWith(DEVICE_TOKEN_PREFIX) || bearer.length > 200) return null;
  const hash = sha256Hex(bearer);
  const [row] = await db
    .select({
      id: agentDevices.id,
      userId: agentDevices.userId,
      monitoringEnabled: agentDevices.monitoringEnabled,
      consentLocalAt: agentDevices.consentLocalAt,
    })
    .from(agentDevices)
    .where(and(eq(agentDevices.tokenHash, hash), eq(agentDevices.status, "active")))
    .limit(1);
  if (!row) return null;
  return { deviceId: row.id, userId: row.userId, monitoringEnabled: row.monitoringEnabled, consentLocalAt: row.consentLocalAt };
}

export function bearerFrom(header: string | null | undefined): string | null {
  if (!header) return null;
  const m = /^Bearer\s+(.+)$/i.exec(header.trim());
  return m ? m[1]!.trim() : null;
}
