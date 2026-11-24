import Link from "next/link";
import { href } from "@/i18n/config";
import { getDict } from "@/i18n/dictionaries";
import { requestLang } from "@/i18n/server";
import { getHighlights } from "@/lib/catalog/service";
import { ListingCard } from "@/components/site/ListingCard";

/** Shown with HTTP 404 when a listing is no longer published: never a stale page. */
export default async function ListingNotFound() {
  const lang = await requestLang();
  const t = getDict(lang);
  const others = await getHighlights(3).catch(() => null);
  return (
    <div className="container py-16 sm:py-20">
      <div className="max-w-2xl">
        <h1 className="font-display text-3xl font-semibold sm:text-4xl">{t.listing.unavailableTitle}</h1>
        <p className="mt-3 text-lg text-ink-muted">{t.listing.unavailableText}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href={href(lang, "catalog")} className="btn-dark">{t.notFound.catalog}</Link>
          <Link href={href(lang, "contact")} className="btn-outline">{t.nav.contact}</Link>
        </div>
      </div>
      {others && others.items.length > 0 && (
        <ul className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {others.items.map((l) => <li key={l.uid}><ListingCard l={l} lang={lang} /></li>)}
        </ul>
      )}
    </div>
  );
}
