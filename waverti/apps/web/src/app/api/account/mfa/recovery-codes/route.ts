import { z } from "zod";
import { regenerateRecoveryCodes, verifySecondFactor } from "@waverti/auth";
import { apiError, json, readJson, withActor } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { encryptionKey, hashPepper } from "@/lib/session";

/** Renouvelle les codes de récupération (les anciens sont révoqués) ; un code valide est exigé. */
export const POST = withActor(
  async (req, actor) => {
    const body = await readJson(req, z.object({ code: z.string().trim().min(6).max(12) }));
    if (!body.ok) return body.res;
    const user = await getCurrentUser();
    if (!user?.mfa.verified || user.id !== actor.userId) return apiError(403, "mfa_required", "Validez d'abord votre double authentification.");
    const db = getDb();
    if (!(await verifySecondFactor(db, actor.userId, body.data.code, encryptionKey(), hashPepper()))) {
      return apiError(422, "invalid_code", "Code incorrect ou expiré. Saisissez le code affiché actuellement.");
    }
    return json({ recoveryCodes: await regenerateRecoveryCodes(db, actor.userId, hashPepper()) }, { headers: { "cache-control": "no-store" } });
  },
  { rate: { name: "mfa-verify", limit: 10, windowSec: 900 } },
);
