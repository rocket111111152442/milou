"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import type { Lang } from "@/i18n/config";
import { getDict } from "@/i18n/dictionaries";
import type { SearchFilters, SortKey } from "@/lib/catalog/types";
import { catalogUrl } from "./url";

export function SortSelect({ lang, filters }: { lang: Lang; filters: SearchFilters }) {
  const t = getDict(lang).search;
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div className="flex items-center gap-2">
      <label htmlFor="sort" className="whitespace-nowrap text-sm text-ink-muted">{t.sort}</label>
      <select
        id="sort"
        className="field min-h-[40px] w-auto py-1.5 pr-8 text-sm"
        value={filters.sort}
        aria-busy={pending}
        onChange={(e) => start(() => router.push(catalogUrl(lang, { ...filters, sort: e.target.value as SortKey, page: 1 }), { scroll: false }))}
      >
        {(Object.keys(t.sorts) as SortKey[]).map((k) => <option key={k} value={k}>{t.sorts[k]}</option>)}
      </select>
    </div>
  );
}
