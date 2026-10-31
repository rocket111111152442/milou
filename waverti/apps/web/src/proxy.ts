import { NextResponse, type NextRequest } from "next/server";
import { databaseUrl } from "./lib/database-url";

/**
 * Première barrière des espaces privés : sans cookie de session, redirection vers la connexion.
 * La session elle-même (validité, double authentification, suspension, rôle) est vérifiée côté
 * serveur dans chaque page/route (requireUser / requireAdmin / withActor).
 */
const SESSION_COOKIE = process.env.NODE_ENV === "production" ? "__Host-waverti_session" : "waverti_session";

export function proxy(request: NextRequest) {
  // /admin n'est pas redirigé vers la connexion : requireAdmin() répond 404 à tout non-administrateur,
  // pour ne pas révéler l'existence de l'administration.
  const isPrivate = request.nextUrl.pathname.startsWith("/app");
  if (!databaseUrl()) {
    if (isPrivate) return NextResponse.redirect(new URL("/connexion?erreur=configuration", request.url));
    return NextResponse.next();
  }
  if (isPrivate && !request.cookies.get(SESSION_COOKIE)?.value) {
    const login = new URL("/connexion", request.url);
    login.searchParams.set("suivant", request.nextUrl.pathname + request.nextUrl.search);
    return NextResponse.redirect(login);
  }
  // Chemin demandé, transmis aux pages pour revenir au bon endroit après la double authentification.
  const forwarded = new Headers(request.headers);
  forwarded.set("x-waverti-path", request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.next({ request: { headers: forwarded } });
}

export const config = {
  matcher: ["/app/:path*", "/admin/:path*", "/connexion/:path*"],
};
