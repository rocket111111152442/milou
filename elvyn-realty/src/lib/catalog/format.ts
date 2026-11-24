import type { ListingSummary, Money } from "./types";
import type { Lang } from "@/i18n/config";

export function formatMoney(m: Money, lang: Lang): string {
  const symbol = m.currency === "USD" ? "US$" : m.currency === "DOP" ? "RD$" : `${m.currency} `;
  const n = new Intl.NumberFormat(lang === "es" ? "es-DO" : "en-US", { maximumFractionDigits: m.amount < 1000 ? 2 : 0 }).format(m.amount);
  return `${symbol}${n}`;
}

export function formatArea(a: { value: number; unit: string }, lang: Lang): string {
  return `${new Intl.NumberFormat(lang === "es" ? "es-DO" : "en-US", { maximumFractionDigits: 0 }).format(a.value)} ${a.unit}`;
}

export interface PriceLabel { main: string; prefix: string | null; suffix: string | null }

/** Price as received: own currency, operation periodicity, "from" for developments. */
export function priceLabel(l: ListingSummary, lang: Lang, preferred?: "sale" | "rent" | null): PriceLabel | null {
  const t = lang === "es" ? { from: "Desde", month: "/mes", night: "/noche" } : { from: "From", month: "/month", night: "/night" };
  const wantRent = preferred === "rent" || (!l.price.sale && !l.price.projectFrom);
  if (wantRent && l.price.rent) return { main: formatMoney(l.price.rent, lang), prefix: null, suffix: t.month };
  if (wantRent && l.price.rental) return { main: formatMoney(l.price.rental, lang), prefix: null, suffix: t.night };
  if (l.price.sale) return { main: formatMoney(l.price.sale, lang), prefix: null, suffix: null };
  if (l.price.projectFrom) return { main: formatMoney(l.price.projectFrom, lang), prefix: t.from, suffix: null };
  if (l.price.rent) return { main: formatMoney(l.price.rent, lang), prefix: null, suffix: t.month };
  if (l.price.rental) return { main: formatMoney(l.price.rental, lang), prefix: null, suffix: t.night };
  return null;
}

export function locationLabel(l: ListingSummary): string {
  return [l.location.sector, l.location.city].filter(Boolean).join(", ") || l.location.province || "";
}

export function categoryLabel(l: ListingSummary, lang: Lang): string | null {
  if (!l.category) return null;
  return (lang === "en" ? l.category.nameEn : null) || l.category.name;
}
