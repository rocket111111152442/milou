import { z } from "zod";
import { apiError, json, readJson, withActor } from "@/lib/api";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Confirmation de l'activation : le premier code valide active le facteur et passe la session en aal2. */
export const POST = withActor(
  async (req) => {
    const body = await readJson(req, z.object({ factorId: z.string().uuid(), code: z.string().regex(/^\d{6}$/, "6 chiffres") }));
    if (!body.ok) return body.res;
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.mfa.challengeAndVerify(body.data);
    if (error) return apiError(422, "invalid_code", "Code incorrect ou expiré. Saisissez le code affiché actuellement.");
    return json({ ok: true });
  },
  { rate: { name: "mfa-verify", limit: 10, windowSec: 900 } },
);
