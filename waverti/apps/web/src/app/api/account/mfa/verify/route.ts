import { z } from "zod";
import { confirmTotpEnrollment } from "@waverti/auth";
import { apiError, json, readJson, withActor } from "@/lib/api";
import { getDb } from "@/lib/db";
import { elevateCurrentSession, encryptionKey, getActiveSession, hashPepper } from "@/lib/session";

/**
 * Confirmation de l'activation : le premier code valide active la double authentification, renvoie
 * les 10 codes de récupération (affichés une seule fois) et passe la session au niveau 2.
 */
export const POST = withActor(
  async (req, actor) => {
    const body = await readJson(req, z.object({ code: z.string().regex(/^\d{6}$/, "6 chiffres") }));
    if (!body.ok) return body.res;
    const codes = await confirmTotpEnrollment(getDb(), actor.userId, body.data.code, encryptionKey(), hashPepper());
    if (!codes) return apiError(422, "invalid_code", "Code incorrect ou expiré. Saisissez le code affiché actuellement.");
    const session = await getActiveSession();
    if (session) await elevateCurrentSession(session);
    return json({ ok: true, recoveryCodes: codes }, { headers: { "cache-control": "no-store" } });
  },
  { rate: { name: "mfa-verify", limit: 10, windowSec: 900 } },
);
