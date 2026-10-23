import type { Metadata } from "next";
import { ArrowUpRight, Phone } from "lucide-react";
import { MapEmbed } from "@/components/home/Visit";
import { Reveal } from "@/components/motion/Reveal";
import { ContactForm } from "@/components/site/ContactForm";
import { OpenBadge } from "@/components/site/OpenBadge";
import { PageHero } from "@/components/site/PageHero";
import { FacebookIcon, InstagramIcon } from "@/components/site/Social";
import { getSettings } from "@/lib/catalog";
import { DAYS } from "@/lib/format";
import type { MessageType } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Contact", description: "Contactez Empreinte de Violettes, artisane fleuriste à Six-Fours-les-Plages : 04 94 32 87 32." };

const TYPES: MessageType[] = ["contact", "mariage", "evenement", "deuil", "entreprise"];

export default async function ContactPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const settings = await getSettings();
  const type = TYPES.includes(sp.type as MessageType) ? (sp.type as MessageType) : "contact";
  return (
    <>
      <PageHero eyebrow="Contact" title="Écrivez-nous," accent="on vous répond" intro="Une question, une commande particulière, un événement à fleurir ? Par message, par téléphone ou en boutique : nous sommes à votre écoute." crumbs={[{ href: "/contact", label: "Contact" }]} compact>
        <div className="mt-8">
          <OpenBadge settings={settings} />
        </div>
      </PageHero>
      <section className="fern-night bg-aubergine-950 py-24">
        <div className="mx-auto grid max-w-[1500px] gap-16 px-6 sm:px-10 lg:grid-cols-[0.8fr_1.2fr] lg:px-16">
          <Reveal className="space-y-10">
            <div>
              <p className="eyebrow mb-3 text-gold/80">Téléphone</p>
              <a href={`tel:${settings.phone.replace(/\s/g, "")}`} className="inline-flex items-center gap-3 font-display text-4xl hover:text-gold-light">
                <Phone className="h-5 w-5" strokeWidth={1.3} /> {settings.phone}
              </a>
            </div>
            <div>
              <p className="eyebrow mb-3 text-gold/80">Boutique</p>
              <a href={settings.mapsUrl} target="_blank" rel="noreferrer" className="group inline-flex items-start gap-2 font-display text-2xl leading-snug hover:text-gold-light">
                <span>
                  {settings.address}
                  <br />
                  {settings.postcode} {settings.city}
                </span>
                <ArrowUpRight className="mt-1 h-4 w-4" />
              </a>
            </div>
            <div>
              <p className="eyebrow mb-3 text-gold/80">Horaires</p>
              <dl className="max-w-xs space-y-1.5 text-sm text-ivory/70">
                {[2, 3, 4, 5, 6, 0, 1].map((d) => {
                  const h = settings.hours.find((x) => x.day === d);
                  return (
                    <div key={d} className="flex justify-between gap-4">
                      <dt>{DAYS[d]}</dt>
                      <dd className="tabular-nums">{!h || h.closed ? "Fermé" : h.ranges.map((r) => `${r.from}–${r.to}`).join(" · ")}</dd>
                    </div>
                  );
                })}
              </dl>
            </div>
            <div className="flex gap-3">
              <a href={settings.instagram} target="_blank" rel="noreferrer" aria-label="Instagram" className="rounded-full border border-ivory/15 p-3 transition hover:border-gold hover:text-gold">
                <InstagramIcon className="h-5 w-5" />
              </a>
              <a href={settings.facebook} target="_blank" rel="noreferrer" aria-label="Facebook" className="rounded-full border border-ivory/15 p-3 transition hover:border-gold hover:text-gold">
                <FacebookIcon className="h-5 w-5" />
              </a>
            </div>
          </Reveal>
          <Reveal delay={0.15}>
            <ContactForm defaultType={type} />
          </Reveal>
        </div>
        <div className="mx-auto mt-20 max-w-[1500px] px-6 sm:px-10 lg:px-16">
          <MapEmbed settings={settings} className="h-[460px]" />
        </div>
      </section>
    </>
  );
}
