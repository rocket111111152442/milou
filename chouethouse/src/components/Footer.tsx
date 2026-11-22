import Image from "next/image";
import Link from "next/link";
import { NAV, SITE } from "@/lib/site";
import { Wave, Star } from "./decor";

export function Footer() {
  return (
    <footer className="relative mt-24 bg-ink text-white/80">
      <Wave color="var(--color-ink)" className="absolute -top-[49px] sm:-top-[79px]" />
      <div className="container-x relative grid gap-12 py-16 md:grid-cols-12">
        <Star className="top-6 right-8 h-10 w-10 animate-spin-slow" />
        <div className="md:col-span-4">
          <div className="inline-block rounded-3xl bg-cream p-4">
            <Image src="/images/logo.webp" alt="Chouet'House – Family Concept" width={200} height={134} className="h-auto w-44" />
          </div>
          <p className="mt-6 max-w-xs">
            Coffee shop, salon de thé et lieu familial à La Seyne-sur-Mer : brunchs, cookies maison, ateliers parents-enfants et anniversaires.
          </p>
          <div className="mt-6 flex gap-3">
            <a href={SITE.instagram} target="_blank" rel="noopener" aria-label="Instagram" className="grid h-11 w-11 place-items-center rounded-full bg-white/10 transition hover:-translate-y-1 hover:bg-coral">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" fill="currentColor" /></svg>
            </a>
            <a href={SITE.facebook} target="_blank" rel="noopener" aria-label="Facebook" className="grid h-11 w-11 place-items-center rounded-full bg-white/10 transition hover:-translate-y-1 hover:bg-sage">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor"><path d="M14 9h3V5h-3c-2.8 0-4 1.8-4 4.3V11H7v4h3v7h4v-7h3l1-4h-4V9.5c0-.4.3-.5 1-.5Z" /></svg>
            </a>
          </div>
        </div>

        <div className="md:col-span-2">
          <h2 className="mb-4 text-lg text-white">Explorer</h2>
          <ul className="space-y-2">
            {NAV.map((n) => (
              <li key={n.href}>
                <Link href={n.href} className="transition hover:text-mustard">
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="md:col-span-3">
          <h2 className="mb-4 text-lg text-white">Nous trouver</h2>
          <address className="not-italic">
            {SITE.fullName}
            <br />
            {SITE.street}
            <br />
            {SITE.postalCode} {SITE.city}
          </address>
          <p className="mt-3">
            <a href={`tel:${SITE.phoneHref}`} className="font-bold text-white hover:text-mustard">{SITE.phone}</a>
            <br />
            <a href={`mailto:${SITE.email}`} className="hover:text-mustard">{SITE.email}</a>
          </p>
        </div>

        <div className="md:col-span-3">
          <h2 className="mb-4 text-lg text-white">Horaires</h2>
          <p className="rounded-3xl bg-white/5 p-5 ring-1 ring-white/10">
            <span className="block font-display text-2xl text-mustard">Lun. – Sam.</span>
            <span className="text-xl text-white">9 h – 18 h</span>
            <span className="mt-1 block text-sm">Fermé le dimanche</span>
          </p>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="container-x flex flex-col items-center justify-between gap-3 py-6 text-sm sm:flex-row">
          <p>© {new Date().getFullYear()} Chouet&apos;House – Family Concept · La Seyne-sur-Mer (83)</p>
          <div className="flex gap-5">
            <Link href="/mentions-legales" className="hover:text-white">Mentions légales</Link>
            <Link href="/confidentialite" className="hover:text-white">Confidentialité</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
