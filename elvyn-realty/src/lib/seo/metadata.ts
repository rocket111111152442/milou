import type { Metadata } from "next";
import { env, catalogMode } from "@/config/env";
import { site } from "@/config/site";
import { href, type Lang, type RouteKey } from "@/i18n/config";

/** Indexing is allowed only on the production deployment with live data. */
export function indexable(): boolean {
  return env.allowIndexing && catalogMode() === "live";
}

export function pageMetadata(opts: {
  lang: Lang;
  route: RouteKey;
  rest?: string;
  title: string;
  description: string;
  image?: string | null;
  noindex?: boolean;
  absoluteTitle?: boolean;
}): Metadata {
  const es = href("es", opts.route, opts.rest);
  const en = href("en", opts.route, opts.rest);
  const canonical = opts.lang === "es" ? es : en;
  const index = indexable() && !opts.noindex;
  const images = [opts.image ?? "/img/hero.jpg"];
  return {
    title: opts.absoluteTitle ? { absolute: opts.title } : opts.title,
    description: opts.description,
    alternates: { canonical, languages: { es, en, "x-default": es } },
    robots: index ? { index: true, follow: true } : { index: false, follow: !opts.noindex || indexable() },
    openGraph: {
      type: "website",
      siteName: site.name,
      locale: opts.lang === "es" ? "es_DO" : "en_US",
      url: canonical,
      title: opts.title,
      description: opts.description,
      images,
    },
    twitter: { card: "summary_large_image", title: opts.title, description: opts.description, images },
  };
}
