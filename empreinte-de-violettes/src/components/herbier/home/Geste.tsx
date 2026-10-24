import { Fade, Mounted, Words } from "../Elements";
import { Plate } from "../Plate";

/** Le manifeste, sur fond prune. */
export function Geste({ label, text, signature, image }: { label: string; text: string; signature: string; image: string }) {
  const [first, ...rest] = text.split(/(?<=\.)\s+/);
  return (
    <section className="h-plum relative overflow-hidden py-28 sm:py-40">
      <Plate name="fougere" opacity={0.1} className="pointer-events-none absolute -left-24 top-10 w-[460px] text-paper max-lg:w-[300px]" />
      <div className="wrap relative grid gap-16 lg:grid-cols-12 lg:gap-10">
        <div className="lg:col-span-7">
          <p className="sc text-paper/50">{label} — V</p>
          <blockquote className="mt-10">
            <p className="font-display text-[clamp(2.2rem,5.2vw,4.6rem)] italic leading-[1.06] tracking-[-0.01em]">
              <Words text={first} stagger={0.05} />
            </p>
            <Fade delay={0.3}>
              <p className="mt-10 max-w-2xl font-text text-[1.12rem] leading-[1.75] text-paper/75 sm:columns-2 sm:gap-10">{rest.join(" ")}</p>
            </Fade>
            <Fade delay={0.45}>
              <footer className="mt-8 font-text text-[1rem] italic text-paper/60">{signature}</footer>
            </Fade>
          </blockquote>
        </div>
        <Fade delay={0.2} className="lg:col-span-4 lg:col-start-9 lg:pt-20">
          <Mounted src={image} alt="Les mains de la fleuriste composant un bouquet" dark ratio="3/4" sizes="(max-width: 1024px) 80vw, 30vw" caption="Fig. 2 — Le bouquet se monte en spirale, tige après tige." />
        </Fade>
      </div>
    </section>
  );
}
