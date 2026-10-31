import { NextResponse, type NextRequest } from "next/server";
import { sameOrigin } from "@/lib/api";
import { endSession, isAuthConfigured } from "@/lib/session";

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return new NextResponse("Forbidden", { status: 403 });
  if (isAuthConfigured()) await endSession();
  const res = NextResponse.redirect(new URL("/", request.url), { status: 303 });
  // Appareil partagé : le navigateur efface aussi le cache HTTP et celui de l'application installée.
  res.headers.set("Clear-Site-Data", '"cache"');
  return res;
}
