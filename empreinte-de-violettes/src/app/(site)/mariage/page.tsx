import type { Metadata } from "next";
import { ContactForm } from "@/components/herbier/ContactForm";
import { Fade, Mounted, RunningHead, Words } from "@/components/herbier/Elements";
import { Lettres } from "@/components/herbier/home/Lettres";
import { PageHead } from "@/components/herbier/PageHead";
import { getContent, getGallery, getReviews, getSettings } from "@/lib/catalog";
import { roman } from "@/lib/roman";
import { IMG } from "@/lib/seed";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Mariages",
  description: "Bouquet de mariée, boutonnières, décoration de cérémonie et de réception : un univers floral sur mesure dans le Var, jusqu'à 80 km de Six-Fours.",
};

const PRESTA = [
  ["Bouquet de la mariée", "Cascade, rond ou champêtre, composé avec vos fleurs préférées."],
  ["Boutonnières & accessoires", "Boutonnières, couronnes et peignes de cheveux, bracelets des demoiselles d'honneur."],
  ["Cérémonie", "Arche, allée, bancs, autel : une mise en scène florale pour le « oui »."],
  ["Réception", "Centres de table, mange-debout, buffet, plan de table fleuri."],
  ["Voiture", "Décoration florale du véhicule des mariés."],
  ["Installation", "Livraison et installation sur place, jusqu'à 80 km (déplacement facturé)."],
];

export default async function WeddingPage() {
  const [content, gallery, reviews, settings] = await Promise.all([getContent(), getGallery(), getReviews(), getSettings()]);
  const w = content.wedding;
  const [t1, ...t2] = w.title.split(",");
  const pics = gallery.filter((g) => g.category === "mariage");
  const pic = (k: number, fallback: string) => pics[k]?.image || fallback;
  return (
    <>
      <PageHead kicker="Mariages" folio="sur rendez-vous" title={t2.length ? `${t1},` : t1} accent={t2.join(",").trim() || undefined} intro={w.intro} plate="lys" />

      <section className="wrap grid gap-16 pb-24 lg:grid-cols-12 lg:gap-10">
        <div className="lg:col-span-6">
          <RunningHead left="Nos prestations" right={roman(PRESTA.length)} />
          <ol className="mt-8">
            {PRESTA.map(([t, d], i) => (
              <Fade key={t} delay={i * 0.05}>
                <li className="grid grid-cols-[2.5rem_1fr] gap-x-4 border-b border-ink/15 py-5">
                  <span className="pt-1 font-text text-[0.9rem] italic text-ink-muted">{roman(i + 1)}.</span>
                  <div>
                    <h3 className="font-display text-[1.6rem] leading-tight">{t}</h3>
                    <p className="body-text mt-1 !text-[1rem]">{d}</p>
                  </div>
                </li>
              </Fade>
            ))}
          </ol>
        </div>
        <div className="grid grid-cols-2 gap-6 lg:col-span-5 lg:col-start-8">
          <Fade className="col-span-2">
            <Mounted src={pic(1, IMG.weddingAisle)} alt="Allée de cérémonie fleurie" ratio="16/11" sizes="(max-width: 1024px) 90vw, 38vw" caption="Fig. 1 — L'allée de cérémonie." />
          </Fade>
          <Fade delay={0.1}>
            <Mounted src={pic(3, IMG.weddingHands)} alt="Bouquet de mariée" ratio="3/4" sizes="20vw" caption="Fig. 2 — Le jour J." />
          </Fade>
          <Fade delay={0.2} className="mt-12">
            <Mounted src={pic(2, IMG.weddingTable)} alt="Table de réception fleurie" ratio="3/4" sizes="20vw" caption="Fig. 3 — À table." />
          </Fade>
        </div>
      </section>

      <section className="h-plum py-24 sm:py-32">
        <div className="wrap grid gap-14 lg:grid-cols-12 lg:gap-10">
          <div className="lg:col-span-4">
            <p className="sc text-paper/50">Le déroulé</p>
            <h2 className="h-section mt-6">
              <Words text="Quatre temps," /> <em><Words text="un seul fil" delay={0.1} /></em>
            </h2>
            <p className="mt-8 font-text text-[1.05rem] italic leading-relaxed text-paper/70">{w.priceNote}</p>
            <p className="mt-4 font-text text-[0.95rem] leading-relaxed text-paper/55">Acompte de 50 % à la signature du devis, solde la semaine du mariage. Carte, virement ou espèces.</p>
          </div>
          <ol className="lg:col-span-7 lg:col-start-6">
            {w.steps.map((s, i) => (
              <Fade key={s.title} delay={i * 0.08}>
                <li className="grid grid-cols-[2.5rem_1fr] gap-x-4 border-t border-paper/15 py-6">
                  <span className="pt-1.5 font-text text-[0.9rem] italic text-paper/50">{roman(i + 1)}.</span>
                  <div>
                    <h3 className="font-display text-[1.8rem] leading-tight">{s.title}</h3>
                    <p className="mt-2 font-text text-[1.02rem] leading-relaxed text-paper/70">{s.text}</p>
                  </div>
                </li>
              </Fade>
            ))}
          </ol>
        </div>
      </section>

      <Lettres reviews={reviews.filter((r) => /mariage/i.test(r.source)).map((r) => ({ id: r.id, author: r.author, text: r.text, source: r.source }))} rating={settings.googleRating} count={settings.googleReviews} numeral="IV" />

      <section id="devis" className="wrap grid gap-14 py-24 sm:py-32 lg:grid-cols-12 lg:gap-10">
        <div className="lg:col-span-4">
          <RunningHead left="Demande de devis" />
          <h2 className="h-section mt-8">
            <Words text="Racontez-nous" /> <em><Words text="votre jour" delay={0.1} /></em>
          </h2>
          <p className="body-text mt-6">Quelques informations suffisent pour un premier échange. Nous revenons vers vous sous 48 heures avec nos disponibilités.</p>
          <a href={`tel:${settings.phone.replace(/\s/g, "")}`} className="tab mt-6 inline-block font-display text-[1.8rem] hover:italic">
            {settings.phone}
          </a>
        </div>
        <div className="lg:col-span-7 lg:col-start-6">
          <ContactForm defaultType="mariage" />
        </div>
      </section>
    </>
  );
}
