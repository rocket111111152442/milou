import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { safeNext } from "@/lib/request";
import { createSupabaseServerClient, isAuthConfigured } from "@/lib/supabase/server";

const TYPES: EmailOtpType[] = ["signup", "email", "recovery", "email_change", "invite", "magiclink"];

/** Lien reçu par e-mail (confirmation, réinitialisation) : flux « token_hash », fonctionne d'un appareil à l'autre. */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = safeNext(searchParams.get("next"), "/app");
  const code = searchParams.get("code");
  if (!isAuthConfigured()) return NextResponse.redirect(new URL("/connexion?erreur=configuration", request.url));
  const supabase = await createSupabaseServerClient();
  if (tokenHash && type && TYPES.includes(type)) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(new URL(type === "recovery" ? "/reinitialiser-mot-de-passe" : next, request.url));
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, request.url));
  }
  return NextResponse.redirect(new URL("/connexion?erreur=lien", request.url));
}
