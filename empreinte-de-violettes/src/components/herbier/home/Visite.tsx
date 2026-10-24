import type { Settings } from "@/lib/types";
import { Fade, Mounted, RunningHead, Words } from "../Elements";
import { Hours } from "../Hours";
import { OpenNow } from "../OpenNow";

export function Visite({ settings, image, numeral = "X" }: { settings: Settings; image: string; numeral?: string }) {
  return (
    <section className="wrap py-24 sm:py-32">
      <RunningHead left="Nous rendre visite" right={numeral} />
      <div className="mt-14 grid gap-14 lg:grid-cols-12 lg:gap-10">
        <Fade className="lg:col-span-5">
          <Mounted src={image} alt="La devanture de la boutique" ratio="4/5" sizes="(max-width: 1024px) 90vw, 36vw" caption="Fig. 5 — La devanture, côté avenue." />
        </Fade>
        <div className="lg:col-span-6 lg:col-start-7 lg:pt-10">
          <h2 className="h-section">
            <Words text="Pousser la porte," /> <em><Words text="sentir les fleurs" delay={0.12} /></em>
          </h2>
          <Fade delay={0.1} className="mt-10">
            <address className="font-display text-[1.65rem] not-italic leading-snug">
              {settings.address}
              <br />
              {settings.postcode} {settings.city}
            </address>
            <OpenNow hours={settings.hours} className="mt-3 block font-text text-[1rem] italic text-ink-soft" />
          </Fade>
          <Fade delay={0.2} className="mt-10 max-w-md">
            <Hours hours={settings.hours} />
          </Fade>
          <Fade delay={0.25} className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-4">
            <a href={settings.mapsUrl} target="_blank" rel="noreferrer" className="btn-label">
              <span>Itinéraire</span>
            </a>
            <a href={`tel:${settings.phone.replace(/\s/g, "")}`} className="btn-line">
              <span className="tab">{settings.phone}</span> <span className="arrow">→</span>
            </a>
          </Fade>
        </div>
      </div>
    </section>
  );
}
