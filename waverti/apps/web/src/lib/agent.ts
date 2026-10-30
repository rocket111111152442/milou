import "server-only";
import { NextResponse } from "next/server";
import { authenticateDevice, bearerFrom, type AuthenticatedDevice } from "@waverti/auth";
import { eq, profiles } from "@waverti/database";
import { apiError, handleApiError } from "./api";
import { getDb, isDatabaseConfigured } from "./db";
import { rateLimit } from "./rate-limit";

export const MAX_DEVICES_PER_USER = 5;

type DeviceHandler = (req: Request, device: AuthenticatedDevice, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>;

/** Routes réservées à l'application desktop (jeton d'appareil Bearer, jamais de cookies). */
export function withDevice(handler: DeviceHandler, opts: { requireConsent?: boolean; rate?: { name: string; limit: number; windowSec: number } } = {}) {
  return async (req: Request, ctx: { params: Promise<Record<string, string>> }) => {
    try {
      if (!isDatabaseConfigured()) return apiError(503, "not_configured");
      const device = await authenticateDevice(getDb(), bearerFrom(req.headers.get("authorization")));
      if (!device) return apiError(401, "invalid_device", "Appareil non reconnu ou révoqué. Reliez de nouveau l'application.");
      const [p] = await getDb().select({ suspendedAt: profiles.suspendedAt }).from(profiles).where(eq(profiles.id, device.userId)).limit(1);
      if (!p || p.suspendedAt) return apiError(403, "suspended", "Compte suspendu.");
      if (opts.requireConsent && (!device.consentLocalAt || !device.monitoringEnabled)) {
        return apiError(403, "consent_required", "Le fonctionnement local doit être accepté et activé dans l'application.");
      }
      if (opts.rate) {
        const r = await rateLimit(`${opts.rate.name}:${device.deviceId}`, opts.rate.limit, opts.rate.windowSec);
        if (!r.ok) return apiError(429, "rate_limited", "Trop de requêtes.", { retryAfter: r.retryAfterSec });
      }
      const res = await handler(req, device, ctx);
      res.headers.set("cache-control", "no-store");
      return res;
    } catch (err) {
      return handleApiError(err);
    }
  };
}

export const noStore = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "cache-control": "no-store" } });
