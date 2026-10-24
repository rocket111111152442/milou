import type { Metadata } from "next";
import { ContactForm } from "@/components/herbier/ContactForm";
import { Fade } from "@/components/herbier/Elements";
import { Hours } from "@/components/herbier/Hours";
import { OpenNow } from "@/components/herbier/OpenNow";
import { PageHead } from "@/components/herbier/PageHead";
import { getSettings } from "@/lib/catalog";
import type { MessageType } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Contact", description: "Contactez Empreinte de Violettes, artisane fleuriste à Six-Fours-les-Plages : 04 94 32 87 32." };

const TYPES: MessageType[] = ["contact", "mariage", "evenement", "deuil", "entreprise"];

export default async function ContactPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const settings = await getSettings();
  const type = TYPES.includes(sp.type as MessageType) ? (sp.type as MessageType) : "contact";
  const q = encodeURIComponent(`${settings.shopName} ${settings.address} ${settings.postcode} ${settings.city}`);
  return (
    <>
      <PageHead kicker="Nous écrire" folio="contact" title="Écrivez-nous," accent="on vous répond" intro="Une question, une commande particulière, un événement à fleurir ? Par lettre, par téléphone ou en boutique : nous sommes là." />
      <section className="wrap grid gap-16 pb-24 lg:grid-cols-12 lg:gap-10">
        <Fade className="space-y-12 lg:col-span-4">
          <div>
            <p className="sc mb-3 text-ink-muted">Par téléphone</p>
            <a href={`tel:${settings.phone.replace(/\s/g, "")}`} className="tab font-display text-[2.2rem] leading-none hover:italic">
              {settings.phone}
            </a>
            <OpenNow hours={settings.hours} className="mt-3 block font-text text-[1rem] italic text-ink-soft" />
          </div>
          <div>
            <p className="sc mb-3 text-ink-muted">En boutique</p>
            <address className="font-display text-[1.45rem] not-italic leading-snug">
              {settings.address}
              <br />
              {settings.postcode} {settings.city}
            </address>
            <a href={settings.mapsUrl} target="_blank" rel="noreferrer" className="btn-line mt-4">
              Itinéraire <span className="arrow">→</span>
            </a>
          </div>
          <div>
            <p className="sc mb-4 text-ink-muted">Heures d&apos;ouverture</p>
            <Hours hours={settings.hours} />
          </div>
          <div className="flex gap-6 font-text text-[1.02rem] italic">
            <a href={`mailto:${settings.email}`} className="ulink">
              {settings.email}
            </a>
          </div>
          <div className="flex gap-6 font-text text-[1.02rem] italic">
            <a href={settings.instagram} target="_blank" rel="noreferrer" className="ulink">
              Instagram
            </a>
            <a href={settings.facebook} target="_blank" rel="noreferrer" className="ulink">
              Facebook
            </a>
          </div>
        </Fade>
        <Fade delay={0.1} className="lg:col-span-7 lg:col-start-6">
          <ContactForm defaultType={type} />
        </Fade>
      </section>
      <section className="wrap pb-28">
        <div className="sheet p-3 sm:p-4">
          <iframe
            title="Plan d'accès à la boutique"
            src={`https://www.google.com/maps?q=${q}&output=embed`}
            className="block h-[420px] w-full border-0 grayscale-[0.6] sepia-[0.15]"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      </section>
    </>
  );
}
