import { href, type Lang } from "@/i18n/config";
import { filtersToParams } from "@/lib/catalog/filters";
import type { SearchFilters } from "@/lib/catalog/types";

/** Catalogue URL for a filter set: /venta and /alquiler carry the operation in the path. */
export function catalogUrl(lang: Lang, f: SearchFilters): string {
  const route = f.operation === "sale" ? "sale" : f.operation === "rent" ? "rent" : "catalog";
  const p = filtersToParams(f, { operation: true });
  return href(lang, route, undefined, p);
}
