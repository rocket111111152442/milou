import QRCode from "qrcode";
import { z } from "zod";
import { disableTotp, startTotpEnrollment, verifySecondFactor } from "@waverti/auth";
import { eq, users } from "@waverti/database";
import { apiError, json, readJson, withActor } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { encryptionKey, hashPepper } from "@/lib/session";

/**
 * Début de l'activation de la double authentification (TOTP) : QR code et clé de configuration.
 * Le secret reste « en attente » (chiffré) tant qu'un premier code n'est pas confirmé.
 */
export const POST = withActor(
  async (_req, actor) => {
    const db = getDb();
    const [u] = await db.select({ id: users.id, email: users.email, enabled: users.totpEnabledAt }).from(users).where(eq(users.id, actor.userId)).limit(1);
    if (!u) return apiError(404, "not_found");
    if (u.enabled) return apiError(409, "already_enabled", "La double authentification est déjà activée.");
    let key: Buffer;
    try {
      key = encryptionKey();
    } catch {
      return apiError(503, "mfa_unavailable", "La double authentification n'est pas disponible sur cet environnement.");
    }
    const { secret, uri } = await startTotpEnrollment(db, u, key);
    const qrCode = await QRCode.toDataURL(uri, { errorCorrectionLevel: "M", margin: 1, width: 240 });
    return json({ qrCode, secret }, { headers: { "cache-control": "no-store" } });
  },
  { rate: { name: "mfa-enroll", limit: 10, windowSec: 3600 } },
);

/** Désactivation : session déjà validée par double authentification ET nouveau code (ou code de récupération). */
export const DELETE = withActor(
  async (req, actor) => {
    const body = await readJson(req, z.object({ code: z.string().trim().min(6).max(12) }));
    if (!body.ok) return body.res;
    const user = await getCurrentUser();
    if (!user?.mfa.verified || user.id !== actor.userId) return apiError(403, "mfa_required", "Validez d'abord votre double authentification.");
    const db = getDb();
    const ok = await verifySecondFactor(db, actor.userId, body.data.code, encryptionKey(), hashPepper());
    if (!ok) return apiError(422, "invalid_code", "Code incorrect ou expiré. Saisissez le code affiché actuellement.");
    await disableTotp(db, actor.userId);
    return json({ ok: true });
  },
  { rate: { name: "mfa-verify", limit: 10, windowSec: 900 } },
);
