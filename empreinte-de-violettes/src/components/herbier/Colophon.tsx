import Link from "next/link";
import { groupHours } from "@/lib/format";
import type { Settings } from "@/lib/types";
import { Label } from "./Label";
import { Letter } from "./Letter";
import { Plate } from "./Plate";


export function Colophon({ settings, categories }: { settings: Settings; categories: { href: string; label: string }[] }) {
  const year = new Date().getFullYear();
  return (
    <footer className="h-plum relative overflow-hidden">
      <Plate name="fougere" reveal="none" opacity={0.07} className="pointer-events-none absolute -right-24 -top-10 w-[520px] text-paper max-md:hidden" />
      <div className="wrap relative pb-10 pt-20 lg:pt-28">
        <div className="grid gap-14 lg:grid-cols-[auto_1fr] lg:gap-24">
          <div className="flex flex-col items-start">
            <Label size="sm" instant />
            <p className="mt-6 max-w-[17rem] font-text text-[0.98rem] italic leading-relaxed text-paper/65">{settings.tagline}. Bouquets façon jardin anglais, plantes et curiosités botaniques.</p>
          </div>

          <div className="grid gap-12 sm:grid-cols-2 xl:grid-cols-4">
            <div>
              <p className="sc mb-4 text-paper/50">La boutique</p>
              <address className="font-text text-[1rem] not-italic leading-relaxed text-paper/85">
                {settings.address}
                <br />
                {settings.postcode} {settings.city}
              </address>
              <p className="mt-3 font-text text-[1rem]">
                <a href={`tel:${settings.phone.replace(/\s/g, "")}`} className="ulink tab">
                  {settings.phone}
                </a>
                <br />
                <a href={`mailto:${settings.email}`} className="ulink text-paper/75">
                  {settings.email}
                </a>
              </p>
              <a href={settings.mapsUrl} target="_blank" rel="noreferrer" className="btn-line mt-5 text-paper/80">
                Itinéraire <span className="arrow">→</span>
              </a>
            </div>

            <div>
              <p className="sc mb-4 text-paper/50">Heures d&apos;ouverture</p>
              <dl className="space-y-3 font-text text-[0.98rem] text-paper/85">
                {groupHours(settings.hours).map((g) => (
                  <div key={g.label}>
                    <dt>{g.label}</dt>
                    <dd className="tab text-paper/60">{g.closed ? <span className="italic">fermé</span> : g.lines.join(", ")}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <div>
              <p className="sc mb-4 text-paper/50">Explorer</p>
              <ul className="space-y-1.5 font-text text-[1rem] text-paper/85">
                {categories.map((c) => (
                  <li key={c.href}>
                    <Link href={c.href} className="ulink">
                      {c.label}
                    </Link>
                  </li>
                ))}
                <li>
                  <Link href="/atelier" className="ulink">
                    Composer un bouquet
                  </Link>
                </li>
                <li>
                  <Link href="/livraison" className="ulink">
                    Livraison &amp; retrait
                  </Link>
                </li>
                <li>
                  <Link href="/suivi" className="ulink">
                    Suivre une commande
                  </Link>
                </li>
                <li>
                  <Link href="/faq" className="ulink">
                    Questions fréquentes
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <p className="sc mb-4 text-paper/50">La lettre des saisons</p>
              <p className="font-text text-[1rem] leading-relaxed text-paper/75">Quatre fois l&apos;an, ce qui fleurit au marché d&apos;Hyères et les créations à venir. Rien d&apos;autre.</p>
              <Letter />
              <p className="mt-6 flex gap-5 font-text text-[0.95rem] italic">
                <a href={settings.instagram} target="_blank" rel="noreferrer" className="ulink">
                  Instagram
                </a>
                <a href={settings.facebook} target="_blank" rel="noreferrer" className="ulink">
                  Facebook
                </a>
              </p>
            </div>
          </div>
        </div>

        <div className="mt-20 flex flex-col gap-4 border-t border-paper/15 pt-6 font-text text-[0.85rem] text-paper/50 lg:flex-row lg:items-baseline lg:justify-between">
          <p>
            © {year} {settings.legalName} · SIRET {settings.siret}
          </p>
          <p className="flex flex-wrap gap-x-5 gap-y-1">
            <Link href="/mentions-legales" className="ulink">
              Mentions légales
            </Link>
            <Link href="/cgv" className="ulink">
              Conditions de vente
            </Link>
            <Link href="/confidentialite" className="ulink">
              Confidentialité
            </Link>
          </p>
          <p className="italic">Gravures anciennes : Wellcome Collection, domaine public.</p>
        </div>
      </div>
    </footer>
  );
}
