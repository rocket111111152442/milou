import { NextResponse, type NextRequest } from "next/server";
import { verifyEmailWithToken } from "@waverti/auth";
import { getDb } from "@/lib/db";
import { safeNext } from "@/lib/request";
import { isAuthConfigured, startSession } from "@/lib/session";

/**
 * Lien de vérification d'adresse reçu par e-mail (jeton à usage unique, 24 h) : active le compte,
 * ouvre une session et redirige vers la suite du parcours (choix de la formule ou essai).
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  const next = safeNext(request.nextUrl.searchParams.get("next"), "/app/abonnement?bienvenue=1");
  if (!isAuthConfigured()) return NextResponse.redirect(new URL("/connexion?erreur=configuration", request.url));
  const userId = token ? await verifyEmailWithToken(getDb(), token) : null;
  if (!userId) return NextResponse.redirect(new URL("/connexion?erreur=lien", request.url));
  await startSession(userId, 1);
  return NextResponse.redirect(new URL(next, request.url));
}
