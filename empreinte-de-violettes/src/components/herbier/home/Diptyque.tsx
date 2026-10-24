import Link from "next/link";
import type { Content } from "@/lib/types";
import { Fade, Mounted } from "../Elements";

/** Mariages et hommages : deux pages en vis-à-vis. */
export function Diptyque({ content, weddingImage, funeralImage }: { content: Content; weddingImage: string; funeralImage: string }) {
  return (
    <section className="grid lg:grid-cols-2">
      <div className="h-paper px-5 py-24 sm:px-8 sm:py-32 lg:px-14 xl:pl-[max(3.5rem,calc((100vw-1440px)/2+3.5rem))]">
        <p className="sc text-ink-muted">VIII — Mariages</p>
        <div className="mt-12 grid gap-10 sm:grid-cols-[0.9fr_1fr] sm:items-end">
          <Fade>
            <Mounted src={weddingImage} alt="Bouquet de mariée" ratio="3/4" sizes="(max-width: 640px) 80vw, 22vw" caption="Fig. 3 — Le jour J." />
          </Fade>
          <Fade delay={0.1}>
            <h2 className="font-display text-[clamp(2rem,3.4vw,3rem)] leading-[1.04]">{content.wedding.title}</h2>
            <p className="body-text mt-5 !text-[1.02rem]">{content.wedding.intro}</p>
            <p className="mt-4 font-text text-[0.95rem] italic text-plum">{content.wedding.priceNote}</p>
            <Link href="/mariage" className="btn-line mt-7">
              Préparer votre mariage <span className="arrow">→</span>
            </Link>
          </Fade>
        </div>
      </div>
      <div className="h-night px-5 py-24 sm:px-8 sm:py-32 lg:px-14 xl:pr-[max(3.5rem,calc((100vw-1440px)/2+3.5rem))]">
        <p className="sc text-paper/50">IX — Deuil &amp; hommage</p>
        <div className="mt-12 grid gap-10 sm:grid-cols-[0.9fr_1fr] sm:items-end">
          <Fade>
            <Mounted src={funeralImage} alt="Composition d'hommage en fleurs blanches" ratio="3/4" dark sizes="(max-width: 640px) 80vw, 22vw" caption="Fig. 4 — En hommage." />
          </Fade>
          <Fade delay={0.1}>
            <h2 className="font-display text-[clamp(2rem,3.4vw,3rem)] leading-[1.04]">{content.funeral.title}</h2>
            <p className="mt-5 font-text text-[1.02rem] leading-[1.68] text-paper/70">{content.funeral.intro}</p>
            <Link href="/deuil" className="btn-line mt-7 text-paper">
              Compositions d&apos;hommage <span className="arrow">→</span>
            </Link>
          </Fade>
        </div>
      </div>
    </section>
  );
}
