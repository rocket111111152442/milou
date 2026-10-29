import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Rafraîchit la session Supabase (cookies) et protège les espaces privés.
 * La vérification d'autorisation reste faite côté serveur dans chaque page/route
 * (requireUser / requireAdmin / withActor) : ce proxy n'est qu'une première barrière.
 */
export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  // /admin n'est pas redirigé vers la connexion : requireAdmin() répond 404 à tout non-administrateur,
  // pour ne pas révéler l'existence de l'administration.
  const isPrivate = request.nextUrl.pathname.startsWith("/app");
  if (!url || !key) {
    if (isPrivate) return NextResponse.redirect(new URL("/connexion?erreur=configuration", request.url));
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        for (const [k, v] of Object.entries(headers ?? {})) response.headers.set(k, v);
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  if (isPrivate && !data?.claims?.sub) {
    const login = new URL("/connexion", request.url);
    login.searchParams.set("suivant", request.nextUrl.pathname + request.nextUrl.search);
    return NextResponse.redirect(login);
  }
  return response;
}

export const config = {
  // Webhooks Stripe, API desktop (jeton Bearer) et fichiers statiques exclus.
  matcher: ["/app/:path*", "/admin/:path*", "/auth/:path*", "/connexion", "/inscription", "/reinitialiser-mot-de-passe", "/api/((?!stripe|agent|health|cron).*)"],
};
