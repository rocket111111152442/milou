import { NextResponse, type NextRequest } from "next/server";
import { sameOrigin } from "@/lib/api";
import { endSession, isAuthConfigured } from "@/lib/session";

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return new NextResponse("Forbidden", { status: 403 });
  if (isAuthConfigured()) await endSession();
  // « Changer de compte » : retour direct à la connexion (liste fermée, aucune adresse libre acceptée).
  const target = request.nextUrl.searchParams.get("vers") === "connexion" ? "/connexion" : "/";
  const res = NextResponse.redirect(new URL(target, request.url), { status: 303 });
  // Appareil partagé : le navigateur efface aussi le cache HTTP et celui de l'application installée.
  res.headers.set("Clear-Site-Data", '"cache"');
  return res;
}
