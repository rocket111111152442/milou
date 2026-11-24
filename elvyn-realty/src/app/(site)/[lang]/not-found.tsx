import Link from "next/link";
import { href } from "@/i18n/config";
import { getDict } from "@/i18n/dictionaries";
import { requestLang } from "@/i18n/server";

export default async function NotFound() {
  const lang = await requestLang();
  const t = getDict(lang);
  return (
    <section className="container flex min-h-[60vh] flex-col items-center justify-center py-20 text-center">
      <p className="font-display text-7xl font-semibold text-brand">404</p>
      <h1 className="mt-4 font-display text-3xl font-semibold sm:text-4xl">{t.notFound.title}</h1>
      <p className="mt-3 max-w-md text-ink-muted">{t.notFound.text}</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href={href(lang, "home")} className="btn-dark">{t.notFound.home}</Link>
        <Link href={href(lang, "catalog")} className="btn-outline">{t.notFound.catalog}</Link>
      </div>
    </section>
  );
}
