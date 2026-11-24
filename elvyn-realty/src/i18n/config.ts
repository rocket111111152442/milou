export const LANGS = ["es", "en"] as const;
export type Lang = (typeof LANGS)[number];
export const DEFAULT_LANG: Lang = "es";
export const isLang = (v: string | undefined | null): v is Lang => v === "es" || v === "en";

/**
 * Route keys → public paths. Spanish lives at the root (same URLs as the current site where
 * they existed); English under /en with English slugs. Internally every page lives under
 * app/(site)/[lang]/<spanish-slug>; middleware.ts rewrites the English slugs.
 */
export const ROUTES = {
  home: { es: "", en: "" },
  catalog: { es: "propiedades", en: "properties" },
  sale: { es: "venta", en: "for-sale" },
  rent: { es: "alquiler", en: "for-rent" },
  listing: { es: "propiedad", en: "property" },
  about: { es: "nosotros", en: "about" },
  team: { es: "agentes", en: "team" },
  services: { es: "servicios", en: "services" },
  sell: { es: "vender-tu-propiedad", en: "sell-your-property" },
  contact: { es: "contacto", en: "contact" },
  privacy: { es: "privacidad", en: "privacy" },
} as const;
export type RouteKey = keyof typeof ROUTES;

/** English slug → internal (Spanish) folder name. */
export const EN_TO_INTERNAL: Record<string, string> = Object.fromEntries(
  Object.values(ROUTES).filter((r) => r.en).map((r) => [r.en, r.es]),
);
export const INTERNAL_TO_EN: Record<string, string> = Object.fromEntries(
  Object.values(ROUTES).filter((r) => r.es).map((r) => [r.es, r.en]),
);

export function href(lang: Lang, key: RouteKey, rest?: string, query?: URLSearchParams | string): string {
  const seg = ROUTES[key][lang];
  const base = lang === "es" ? "" : "/en";
  let path = `${base}${seg ? `/${seg}` : ""}${rest ? `/${rest}` : ""}` || "/";
  if (lang === "en" && path === "/en") path = "/en";
  const q = typeof query === "string" ? query : query?.toString();
  return q ? `${path}?${q}` : path;
}

/** Equivalent URL in the other language for the language switcher (internal pathname in). */
export function switchLangPath(internalPath: string, to: Lang): string {
  // internalPath: /es/propiedad/slug or /en/propiedad/slug
  const parts = internalPath.split("/").filter(Boolean);
  const rest = parts.slice(1);
  if (to === "es") return "/" + rest.join("/");
  if (rest[0] && INTERNAL_TO_EN[rest[0]]) rest[0] = INTERNAL_TO_EN[rest[0]];
  return "/en" + (rest.length ? "/" + rest.join("/") : "");
}
