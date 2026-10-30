import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/lib/request";
import { createSupabaseServerClient, isAuthConfigured } from "@/lib/supabase/server";

/** Retour OAuth / PKCE (code d'autorisation). */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = safeNext(request.nextUrl.searchParams.get("next"), "/app");
  if (code && isAuthConfigured()) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, request.url));
  }
  return NextResponse.redirect(new URL("/connexion?erreur=lien", request.url));
}
