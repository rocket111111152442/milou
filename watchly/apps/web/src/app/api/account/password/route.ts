import { z } from "zod";
import { apiError, json, readJson, withActor } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Changement de mot de passe : le mot de passe actuel est vérifié avant la modification. */
export const POST = withActor(
  async (req) => {
    const body = await readJson(
      req,
      z.object({
        current: z.string().min(1).max(128),
        next: z
          .string()
          .min(10, "10 caractères minimum")
          .max(128)
          .refine((p) => /[a-zA-Z]/.test(p) && /[0-9\W_]/.test(p), "Mélangez lettres et chiffres ou symboles"),
      }),
    );
    if (!body.ok) return body.res;
    if (body.data.current === body.data.next) return apiError(422, "same_password", "Le nouveau mot de passe doit être différent.");
    const user = await getCurrentUser();
    const supabase = await createSupabaseServerClient();
    const check = await supabase.auth.signInWithPassword({ email: user!.email, password: body.data.current });
    if (check.error) return apiError(403, "wrong_password", "Mot de passe actuel incorrect.");
    const { error } = await supabase.auth.updateUser({ password: body.data.next });
    if (error) return apiError(422, "rejected", "Ce mot de passe n'est pas accepté. Choisissez-en un plus robuste.");
    await supabase.auth.signOut({ scope: "others" });
    return json({ ok: true });
  },
  { rate: { name: "password", limit: 5, windowSec: 3600 } },
);
