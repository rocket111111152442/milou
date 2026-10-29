import "server-only";
import { apiError, handleApiError, sameOrigin } from "./api";
import { getCurrentUser } from "./auth";
import { createSupabaseServerClient } from "./supabase/server";

type AdminHandler = (req: Request, admin: { userId: string; email: string }, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>;

/**
 * Routes d'administration : session web d'un administrateur uniquement (jamais un jeton d'appareil),
 * même origine pour les écritures, réponse 404 pour tout autre visiteur.
 */
export function withAdmin(handler: AdminHandler) {
  return async (req: Request, ctx: { params: Promise<Record<string, string>> }) => {
    try {
      if (req.headers.get("authorization")) return apiError(404, "not_found");
      const user = await getCurrentUser();
      if (!user || user.suspended || user.role !== "admin") return apiError(404, "not_found");
      if (process.env.ADMIN_REQUIRE_MFA === "1") {
        const supabase = await createSupabaseServerClient();
        const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        if (data?.currentLevel !== "aal2") return apiError(404, "not_found");
      }
      if (req.method !== "GET" && !sameOrigin(req)) return apiError(403, "bad_origin");
      return await handler(req, { userId: user.id, email: user.email }, ctx);
    } catch (err) {
      return handleApiError(err);
    }
  };
}
