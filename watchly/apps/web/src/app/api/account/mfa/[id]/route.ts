import { z } from "zod";
import { apiError, json, readJson, withActor } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Désactivation : session déjà validée par double authentification ET nouveau code exigé. */
export const DELETE = withActor(
  async (req, _actor, ctx) => {
    const { id } = await ctx.params;
    const body = await readJson(req, z.object({ code: z.string().regex(/^\d{6}$/, "6 chiffres") }));
    if (!body.ok) return body.res;
    const user = await getCurrentUser();
    if (!user?.mfa.verified || user.mfa.factorId !== id) return apiError(404, "not_found");
    const supabase = await createSupabaseServerClient();
    const check = await supabase.auth.mfa.challengeAndVerify({ factorId: id, code: body.data.code });
    if (check.error) return apiError(422, "invalid_code", "Code incorrect ou expiré. Saisissez le code affiché actuellement.");
    const { error } = await supabase.auth.mfa.unenroll({ factorId: id });
    if (error) return apiError(503, "mfa_unavailable", "Désactivation impossible pour le moment.");
    return json({ ok: true });
  },
  { rate: { name: "mfa-verify", limit: 10, windowSec: 900 } },
);
