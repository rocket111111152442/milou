import Link from "next/link";
import type { Content } from "@/lib/types";
import { Fade, Leader, Mounted, RunningHead, Words } from "../Elements";

export function AvantPropos({ content, image, caption }: { content: Content; image: string; caption: string }) {
  const about = content.about;
  const notes: [string, string][] = content.stats.map((s) => [s.label.charAt(0).toUpperCase() + s.label.slice(1), s.value]);
  return (
    <section className="wrap pb-24 pt-10 sm:pb-32 lg:pt-16">
      <RunningHead left="Avant-propos" right="I" />
      <div className="mt-14 grid gap-14 lg:grid-cols-12 lg:gap-10">
        <div className="lg:col-span-5">
          <h2 className="h-section">
            <Words text="Une boutique comme" /> <em className="text-plum"><Words text="un cabinet de curiosités" delay={0.15} /></em>
          </h2>
          <Fade delay={0.2} className="mt-12 max-w-[25rem]">
            <Mounted src={image} alt={caption} ratio="4/5" sizes="(max-width: 1024px) 80vw, 30vw" caption={<>Fig. 1 — {caption}</>} />
          </Fade>
        </div>
        <div className="lg:col-span-6 lg:col-start-7 lg:pt-24">
          <Fade>
            <p className="lettrine body-text !text-[1.2rem] !leading-[1.7] text-ink sm:!text-[1.3rem]">{about.intro}</p>
          </Fade>
          <Fade delay={0.1}>
            <p className="body-text mt-6">{about.paragraphs[0]}</p>
          </Fade>
          <Fade delay={0.15}>
            <p className="body-text mt-5">{about.paragraphs[1]}</p>
          </Fade>
          <Fade delay={0.2} className="mt-12 border-t border-ink/15 pt-6">
            <p className="sc mb-4 text-ink-muted">En quelques notes</p>
            <div className="space-y-2.5 font-text text-[1rem]">
              {notes.map(([a, b]) => (
                <Leader key={a} left={a} right={<span className="italic text-ink-soft">{b}</span>} />
              ))}
            </div>
          </Fade>
          <Fade delay={0.25} className="mt-10">
            <Link href="/la-maison" className="btn-line">
              L&apos;histoire de la Maison <span className="arrow">→</span>
            </Link>
          </Fade>
        </div>
      </div>
    </section>
  );
}
