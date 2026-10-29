import { apiError, json, withActor } from "@/lib/api";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Début de l'activation de la double authentification (TOTP) : renvoie le QR code et la clé à
 * saisir dans l'application d'authentification. Le facteur reste inactif tant qu'un code n'est pas confirmé.
 */
export const POST = withActor(
  async () => {
    const supabase = await createSupabaseServerClient();
    const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
    if (listError || !factors) return apiError(503, "mfa_unavailable", "La double authentification n'est pas disponible pour le moment.");
    if (factors.totp.length) return apiError(409, "already_enabled", "La double authentification est déjà activée.");
    // Tentative précédente non confirmée : supprimée avant d'en commencer une nouvelle.
    for (const f of factors.all) if (f.status === "unverified") await supabase.auth.mfa.unenroll({ factorId: f.id });
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "Application d'authentification", issuer: "Watchly" });
    if (error || !data) return apiError(503, "mfa_unavailable", "La double authentification n'est pas disponible pour le moment.");
    return json({ factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret }, { headers: { "cache-control": "no-store" } });
  },
  { rate: { name: "mfa-enroll", limit: 10, windowSec: 3600 } },
);
