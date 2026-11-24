import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isLang, type Lang, type RouteKey } from "@/i18n/config";
import { getDict } from "@/i18n/dictionaries";
import { hasRefinements, parseFilters, type RawParams } from "@/lib/catalog/filters";
import type { SearchFilters } from "@/lib/catalog/types";
import { pageMetadata } from "@/lib/seo/metadata";
import { CatalogView } from "./CatalogView";
import { catalogUrl } from "./url";

type Kind = "catalog" | "sale" | "rent";
type Props = { params: Promise<{ lang: string }>; searchParams: Promise<RawParams> };

const preset = (k: Kind): Partial<SearchFilters> => (k === "sale" ? { operation: "sale" } : k === "rent" ? { operation: "rent" } : {});
const LEGACY = ["listing_type", "category", "currency", "page", "country"];

function texts(lang: Lang, kind: Kind) {
  const c = getDict(lang).catalog;
  if (kind === "sale") return { title: c.saleTitle, description: c.saleDescription };
  if (kind === "rent") return { title: c.rentTitle, description: c.rentDescription };
  return { title: c.title, description: c.description };
}

export function catalogMetadata(kind: Kind) {
  return async ({ params, searchParams }: Props): Promise<Metadata> => {
    const { lang: raw } = await params;
    const lang: Lang = isLang(raw) ? raw : "es";
    const sp = await searchParams;
    const f = parseFilters(sp, preset(kind));
    const { title, description } = texts(lang, kind);
    // Filter combinations and deep pages are not indexed; canonical points to the clean page.
    return pageMetadata({ lang, route: kind as RouteKey, title, description, noindex: hasRefinements(f, preset(kind)) || f.page > 1 });
  };
}

export function catalogPage(kind: Kind) {
  return async function Page({ params, searchParams }: Props) {
    const { lang: raw } = await params;
    const lang: Lang = isLang(raw) ? raw : "es";
    const sp = await searchParams;
    const filters = parseFilters(sp, kind === "catalog" ? {} : preset(kind));
    // Old AlterEstate links (?listing_type=1&currency=DOP&page=1…) → clean URL
    if (LEGACY.some((k) => k in sp)) redirect(catalogUrl(lang, filters));
    // Operation chosen on the generic page → dedicated /venta or /alquiler URL
    if (kind === "catalog" && filters.operation) redirect(catalogUrl(lang, filters));
    const { title, description } = texts(lang, kind);
    return <CatalogView lang={lang} filters={filters} title={title} intro={description} />;
  };
}
