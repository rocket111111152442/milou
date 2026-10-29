import { NextResponse, type NextRequest } from "next/server";
import { appUrl } from "@/lib/request";
import { createSupabaseServerClient, isAuthConfigured } from "@/lib/supabase/server";

/** Connexion Google : active uniquement si le fournisseur OAuth est configuré (NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=1). */
export async function GET(request: NextRequest) {
  if (process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED !== "1" || !isAuthConfigured()) {
    return NextResponse.redirect(new URL("/connexion", request.url));
  }
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${appUrl()}/auth/callback?next=/app` },
  });
  if (error || !data.url) return NextResponse.redirect(new URL("/connexion?erreur=lien", request.url));
  return NextResponse.redirect(data.url);
}
