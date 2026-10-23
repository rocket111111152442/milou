import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Counter } from "@/components/motion/Counter";
import { ImageReveal, Parallax, Reveal } from "@/components/motion/Reveal";
import { ScrollWords } from "@/components/motion/ScrollWords";
import { VioletMark } from "@/components/site/Logo";
import { PageHero } from "@/components/site/PageHero";
import { SectionTitle } from "@/components/site/SectionTitle";
import { SmartImage } from "@/components/site/SmartImage";
import { Steps } from "@/components/site/Steps";
import { getContent } from "@/lib/catalog";
import { IMG } from "@/lib/seed";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "La Maison",
  description: "Empreinte de Violettes, artisane fleuriste à Six-Fours-les-Plages depuis 2022 : style jardin à l'anglaise, fleurs locales, formation auprès d'un Meilleur Ouvrier de France.",
};

export default async function AboutPage() {
  const content = await getContent();
  const a = content.about;
  return (
    <>
      <PageHero eyebrow="Notre histoire" title="Une passion" accent="qui laisse son empreinte" intro={a.intro} image={a.image} crumbs={[{ href: "/la-maison", label: "La Maison" }]} />

      <section className="fern-paper bg-ivory py-28 text-noir sm:py-36">
        <div className="mx-auto grid max-w-[1500px] gap-16 px-6 sm:px-10 lg:grid-cols-2 lg:px-16">
          <div className="space-y-8">
            {a.paragraphs.map((p, i) => (
              <Reveal key={i} delay={i * 0.08}>
                <p className={i === 0 ? "font-display text-3xl leading-snug text-aubergine-900" : "text-lg leading-relaxed text-noir/70"}>{p}</p>
              </Reveal>
            ))}
          </div>
          <div className="relative">
            <Parallax speed={0.1}>
              <ImageReveal className="aspect-[4/5] w-full rounded-t-full">
                <SmartImage src={IMG.handsFern} alt="Le geste de la fleuriste" fill sizes="(max-width: 1024px) 90vw, 45vw" className="object-cover" />
              </ImageReveal>
            </Parallax>
            <Parallax speed={0.25} className="absolute -bottom-10 -left-6 w-[45%]">
              <ImageReveal className="aspect-square rounded-full border-8 border-ivory" delay={0.2}>
                <SmartImage src={IMG.dried} alt="Fleurs séchées de la boutique" fill sizes="25vw" className="object-cover" />
              </ImageReveal>
            </Parallax>
          </div>
        </div>
      </section>

      <section className="bg-noir py-28 sm:py-36">
        <div className="mx-auto max-w-[1300px] px-6 text-center sm:px-10">
          <VioletMark className="mx-auto h-14 w-14 text-gold" />
          <ScrollWords
            text="Un cabinet de curiosités botaniques : plantes rares, fleurs séchées, feuillages sombres et objets chinés. On y entre pour un bouquet, on y reste pour flâner."
            className="mt-10 font-display text-[clamp(2rem,4.4vw,4.4rem)] font-light italic leading-[1.15]"
          />
        </div>
      </section>

      <section className="fern-night bg-aubergine-950 py-28 sm:py-36">
        <div className="mx-auto grid max-w-[1600px] gap-16 px-6 sm:px-10 lg:grid-cols-2 lg:px-16">
          <div>
            <SectionTitle eyebrow="Le parcours" title="De l'apprentissage" accent="à la Maison" size="md" />
            <div className="mt-12 grid grid-cols-3 gap-6">
              {[
                ["2022", "Ouverture"],
                ["80 %", "Fleurs locales"],
                ["4,8/5", "Avis Google"],
              ].map(([v, l]) => (
                <div key={l}>
                  <Counter value={v} className="font-display text-5xl text-gold-light" />
                  <p className="mt-2 text-xs uppercase tracking-[0.18em] text-ivory/50">{l}</p>
                </div>
              ))}
            </div>
          </div>
          <Steps
            tone="dark"
            steps={[
              { title: "L'apprentissage", text: "Auprès de plusieurs artisans fleuristes, dont un Meilleur Ouvrier de France : la rigueur du geste et le respect de la fleur." },
              { title: "CAP puis BP fleuriste", text: "Deux diplômes pour maîtriser la technique, la composition et la conduite d'une boutique." },
              { title: "Avril 2022", text: "Ouverture d'Empreinte de Violettes, avenue Maréchal de Lattre de Tassigny, à Six-Fours-les-Plages." },
              { title: "Aujourd'hui", text: "Bouquets du quotidien, mariages, deuil, entreprises… et une communauté fidèle : 4,8/5 sur près de 200 avis." },
            ]}
          />
        </div>
      </section>

      <section className="fern-paper bg-paper py-28 text-noir">
        <div className="mx-auto max-w-[1600px] px-6 sm:px-10 lg:px-16">
          <SectionTitle eyebrow="Nos engagements" title="Ce qui nous" accent="guide" tone="light" size="md" align="center" />
          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {a.values.map((v, i) => (
              <Reveal key={v.title} delay={i * 0.1} className="group rounded-[2rem] border border-noir/10 bg-white/60 p-8 transition duration-500 hover:-translate-y-2 hover:shadow-[0_30px_60px_-30px_rgba(38,21,47,0.4)]">
                <span className="font-caps text-xs tracking-[0.3em] text-aubergine-500">{String(i + 1).padStart(2, "0")}</span>
                <h3 className="mt-6 font-display text-3xl transition group-hover:italic group-hover:text-aubergine-700">{v.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-noir/60">{v.text}</p>
              </Reveal>
            ))}
          </div>
          <div className="mt-16 text-center">
            <Link href="/boutique" className="btn btn-noir">
              <span>Découvrir nos créations</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
