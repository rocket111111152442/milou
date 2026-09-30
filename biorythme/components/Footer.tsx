import Link from "next/link";
import Logo from "./Logo";
import { CLUBS, CONTACT_EMAIL, FACEBOOK_URL } from "@/lib/site";

export default function Footer() {
  return (
    <footer className="relative mt-32 overflow-hidden border-t border-line">
      <div className="mx-auto grid max-w-7xl gap-12 px-4 py-16 sm:px-6 md:grid-cols-4">
        <div className="md:col-span-2">
          <Logo className="text-4xl" />
          <p className="mt-4 max-w-sm text-muted">
            Deux clubs, une équipe de coachs professionnels et diplômés, des cours collectifs toute la journée.
          </p>
          <a href={`mailto:${CONTACT_EMAIL}`} className="mt-6 inline-block text-bone underline decoration-volt underline-offset-4">
            {CONTACT_EMAIL}
          </a>
          <a href={FACEBOOK_URL} target="_blank" rel="noreferrer" className="mt-3 block text-sm text-muted hover:text-bone">
            Facebook ↗
          </a>
        </div>
        {Object.values(CLUBS).map((c) => (
          <div key={c.id}>
            <p className="text-xs uppercase tracking-[0.2em] text-volt">{c.city}</p>
            <p className="mt-3 text-sm text-bone/80">{c.address}</p>
            <ul className="mt-3 grid gap-0.5 text-xs text-muted">
              {c.hours.map((h) => (
                <li key={h.days}>
                  {h.days} : <span className="text-bone/80">{h.time}</span>
                </li>
              ))}
            </ul>
            <a href={`tel:${c.phoneHref}`} className="mt-2 block text-sm font-semibold hover:text-volt">
              {c.phone}
            </a>
          </div>
        ))}
      </div>
      <div className="border-t border-line">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-6 text-xs text-muted sm:px-6">
          <span>© {new Date().getFullYear()} Biorythme. Tous droits réservés.</span>
          <div className="flex gap-6">
            <Link href="/planning" className="hover:text-bone">Planning</Link>
            <Link href="/galerie" className="hover:text-bone">Galerie</Link>
            <Link href="/contact" className="hover:text-bone">Contact</Link>
            <Link href="/mentions-legales" className="hover:text-bone">Mentions légales</Link>
            <Link href="/admin" className="hover:text-bone">Espace gérante</Link>
          </div>
        </div>
      </div>
      <p
        aria-hidden
        className="font-display pointer-events-none -mb-[0.18em] select-none text-center text-[22vw] leading-none text-surface-2"
      >
        Biorythme
      </p>
    </footer>
  );
}
