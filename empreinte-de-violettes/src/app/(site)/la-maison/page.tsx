import type { Metadata } from "next";
import Link from "next/link";
import { Fade, Mounted, RunningHead, Words } from "@/components/herbier/Elements";
import { PageHead } from "@/components/herbier/PageHead";
import { Plate } from "@/components/herbier/Plate";
import { getContent, getGallery, getSettings } from "@/lib/catalog";
import { roman } from "@/lib/roman";
import { IMG } from "@/lib/seed";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "La Maison",
  description: "Empreinte de Violettes, artisane fleuriste à Six-Fours-les-Plages depuis 2022 : style jardin à l'anglaise, fleurs locales, formation auprès d'un Meilleur Ouvrier de France.",
};

export default async function AboutPage() {
  const [content, gallery, settings] = await Promise.all([getContent(), getGallery(), getSettings()]);
  const a = content.about;
  const parcours = [
    ["L'apprentissage", "auprès de plusieurs artisans", "Dont un Meilleur Ouvrier de France : la rigueur du geste et le respect de la fleur."],
    ["CAP puis BP fleuriste", "les diplômes", "Pour maîtriser la technique, la composition et la conduite d'une boutique."],
    ["Avril 2022", "l'ouverture", `Empreinte de Violettes s'installe ${settings.address.replace(/^\d+\s*/, "")}, à ${settings.city}.`],
    ["Aujourd'hui", "la Maison", `Bouquets du quotidien, mariages, deuil, entreprises — et ${settings.googleRating.toLocaleString("fr-FR")}/5 sur ${settings.googleReviews} avis Google.`],
  ];
  const photos = gallery.filter((g) => g.category === "atelier" || g.category === "boutique").slice(0, 3);
  return (
    <>
      <PageHead kicker="La Maison" folio="depuis 2022" title="Une passion" accent="qui laisse son empreinte" intro={a.intro} plate="violette" />

      <section className="wrap grid gap-16 pb-24 lg:grid-cols-12 lg:gap-10">
        <div className="space-y-6 lg:col-span-6">
          {a.paragraphs.map((p, i) => (
            <Fade key={i} delay={i * 0.08}>
              <p className={i === 0 ? "lettrine body-text !text-[1.25rem] text-ink" : "body-text"}>{p}</p>
            </Fade>
          ))}
        </div>
        <div className="relative lg:col-span-5 lg:col-start-8">
          <Fade>
            <Mounted src={a.image || IMG.shopFront} alt="La boutique Empreinte de Violettes" ratio="4/5" sizes="(max-width: 1024px) 90vw, 38vw" caption="Fig. 1 — La boutique." />
          </Fade>
          <Fade delay={0.2} className="-mt-16 ml-auto w-[52%] sm:-mt-24">
            <Mounted src={content.manifesto.image || IMG.handsFern} alt="Le geste de la fleuriste" ratio="1/1" sizes="22vw" caption="Fig. 2 — Le geste." />
          </Fade>
        </div>
      </section>

      <section className="h-plum relative overflow-hidden py-28 sm:py-36">
        <Plate name="graminee" opacity={0.1} className="pointer-events-none absolute -right-10 top-0 w-[300px] text-paper max-md:w-[180px]" />
        <div className="wrap relative max-w-5xl text-center">
          <p className="font-display text-[clamp(1.9rem,4.4vw,3.8rem)] italic leading-[1.15]">
            <Words text="Un cabinet de curiosités botaniques : plantes rares, fleurs séchées, feuillages sombres et objets chinés. On y entre pour un bouquet, on y reste pour flâner." stagger={0.025} />
          </p>
        </div>
      </section>

      <section className="wrap py-24 sm:py-32">
        <RunningHead left="Le parcours" right="registre" />
        <ol className="mt-12 border-t border-ink/15">
          {parcours.map(([t, k, d], i) => (
            <Fade key={t} delay={i * 0.06}>
              <li className="grid gap-3 border-b border-ink/15 py-7 md:grid-cols-[3rem_1fr_1.4fr] md:gap-8">
                <span className="font-text text-[0.9rem] italic text-ink-muted">{roman(i + 1)}.</span>
                <div>
                  <h3 className="font-display text-[1.9rem] leading-tight">{t}</h3>
                  <p className="font-text text-[0.95rem] italic text-ink-muted">{k}</p>
                </div>
                <p className="body-text">{d}</p>
              </li>
            </Fade>
          ))}
        </ol>
      </section>

      <section className="h-paper-deep py-24 sm:py-32">
        <div className="wrap">
          <RunningHead left="Ce qui nous guide" right={roman(a.values.length)} />
          <div className="mt-12 grid gap-x-16 gap-y-12 md:grid-cols-2">
            {a.values.map((v, i) => (
              <Fade key={v.title} delay={(i % 2) * 0.1} className="border-t border-ink/20 pt-6">
                <p className="font-text text-[0.9rem] italic text-ink-muted">{roman(i + 1)}.</p>
                <h3 className="mt-2 font-display text-[2rem] leading-tight">{v.title}</h3>
                <p className="body-text mt-3">{v.text}</p>
              </Fade>
            ))}
          </div>
        </div>
      </section>

      {photos.length > 0 && (
        <section className="wrap py-24 sm:py-32">
          <RunningHead left="Quelques planches photographiques" />
          <div className="mt-12 grid gap-10 sm:grid-cols-3">
            {photos.map((g, i) => (
              <Fade key={g.id} delay={i * 0.1} className={i === 1 ? "sm:mt-16" : ""}>
                <Mounted src={g.image} alt={g.caption} ratio="4/5" sizes="(max-width: 640px) 90vw, 30vw" caption={`Fig. ${i + 3} — ${g.caption}.`} />
              </Fade>
            ))}
          </div>
          <div className="mt-20 flex flex-wrap items-center justify-center gap-8">
            <Link href="/boutique" className="btn-label">
              <span>Découvrir nos créations</span>
            </Link>
            <Link href="/contact" className="btn-line">
              Nous rendre visite <span className="arrow">→</span>
            </Link>
          </div>
        </section>
      )}
    </>
  );
}
