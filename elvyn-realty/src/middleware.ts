import { NextResponse, type NextRequest } from "next/server";
import { EN_TO_INTERNAL, INTERNAL_TO_EN } from "@/i18n/config";
import { SESSION_COOKIE, verifySession } from "@/lib/auth/session";
import { parseFilters, type RawParams } from "@/lib/catalog/filters";
import { catalogUrl } from "@/components/site/catalog/url";

const LEGACY_PARAMS = ["listing_type", "category", "currency", "page", "country"];

/** Old AlterEstate catalogue links and ?operacion= on the generic page → clean 308 redirect. */
function catalogRedirect(req: NextRequest, lang: "es" | "en", internalSeg: string | undefined): NextResponse | null {
  if (internalSeg !== "propiedades" && internalSeg !== "venta" && internalSeg !== "alquiler") return null;
  const sp = req.nextUrl.searchParams;
  const legacy = LEGACY_PARAMS.some((k) => sp.has(k));
  const opOnGeneric = internalSeg === "propiedades" && sp.has("operacion");
  if (!legacy && !opOnGeneric) return null;
  const raw: RawParams = {};
  for (const k of new Set(sp.keys())) raw[k] = sp.getAll(k);
  const preset = internalSeg === "venta" ? { operation: "sale" as const } : internalSeg === "alquiler" ? { operation: "rent" as const } : {};
  return NextResponse.redirect(new URL(catalogUrl(lang, parseFilters(raw, preset)), req.url), 308);
}

/**
 * - Spanish pages live at the root (/propiedades) and are rewritten to /es/…
 * - English pages live under /en with English slugs (/en/properties) → /en/propiedades
 * - /admin is protected (the session is also re-checked server-side on every page/action).
 * - Old AlterEstate catalogue links with listing_type/category/currency/page keep working
 *   (parsed by the catalogue page itself).
 */
function withLang(req: NextRequest, lang: "es" | "en") {
  const h = new Headers(req.headers);
  h.set("x-lang", lang);
  h.set("x-pathname", req.nextUrl.pathname);
  return h;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/admin")) {
    if (pathname === "/admin/login") return NextResponse.next();
    const ok = await verifySession(req.cookies.get(SESSION_COOKIE)?.value).catch(() => null);
    if (!ok) {
      const url = req.nextUrl.clone();
      url.pathname = "/admin/login";
      url.search = "";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  const parts = pathname.split("/").filter(Boolean);

  // /es/... is not a public URL: canonical Spanish URLs have no prefix.
  if (parts[0] === "es") {
    const url = req.nextUrl.clone();
    url.pathname = "/" + parts.slice(1).join("/");
    return NextResponse.redirect(url, 308);
  }

  if (parts[0] === "en") {
    const seg = parts[1];
    if (seg && INTERNAL_TO_EN[seg] && !EN_TO_INTERNAL[seg]) {
      // Spanish slug under /en → redirect to the English slug
      const url = req.nextUrl.clone();
      url.pathname = ["", "en", INTERNAL_TO_EN[seg], ...parts.slice(2)].join("/");
      return NextResponse.redirect(url, 308);
    }
    const internal = seg ? EN_TO_INTERNAL[seg] : undefined;
    const enRedirect = catalogRedirect(req, "en", internal);
    if (enRedirect) return enRedirect;
    if (seg && !internal) return NextResponse.rewrite(new URL("/en/__not-found", req.url), { request: { headers: withLang(req, "en") } });
    const url = req.nextUrl.clone();
    url.pathname = ["", "en", ...(internal ? [internal] : []), ...parts.slice(2)].join("/");
    const res = NextResponse.rewrite(url, { request: { headers: withLang(req, "en") } });
    res.headers.set("Content-Language", "en");
    return res;
  }

  const esRedirect = catalogRedirect(req, "es", parts[0]);
  if (esRedirect) return esRedirect;
  const url = req.nextUrl.clone();
  url.pathname = "/es" + (pathname === "/" ? "" : pathname);
  const res = NextResponse.rewrite(url, { request: { headers: withLang(req, "es") } });
  res.headers.set("Content-Language", "es");
  return res;
}

export const config = {
  matcher: ["/((?!api|_next|img|brand|favicon|icon|apple-icon|robots.txt|sitemap.xml|opengraph-image|.*\\.(?:png|jpg|jpeg|webp|svg|ico|txt|xml|json)$).*)"],
};
