import type { Metadata } from "next";
import { GalleryGrid } from "@/components/home/GalleryGrid";
import { Testimonials } from "@/components/home/Testimonials";
import { Marquee } from "@/components/motion/Marquee";
import { ImageReveal, Reveal } from "@/components/motion/Reveal";
import { ContactForm } from "@/components/site/ContactForm";
import { PageHero } from "@/components/site/PageHero";
import { SectionTitle } from "@/components/site/SectionTitle";
import { SmartImage } from "@/components/site/SmartImage";
import { Steps } from "@/components/site/Steps";
import { getContent, getGallery, getReviews, getSettings } from "@/lib/catalog";
import { IMG } from "@/lib/seed";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Mariages",
  description: "Bouquet de mariée, boutonnières, décoration de cérémonie et de réception : un univers floral sur mesure dans le Var, jusqu'à 80 km de Six-Fours.",
};

const PRESTA = [
  ["Bouquet de la mariée", "Cascade, rond ou champêtre, composé avec vos fleurs préférées."],
  ["Boutonnières & accessoires", "Boutonnières, couronnes et peignes de cheveux, bracelets de demoiselles d'honneur."],
  ["Cérémonie", "Arche, allée, bancs, autel : une mise en scène florale pour le « oui »."],
  ["Réception", "Centres de table, mange-debout, buffet, plan de table fleuri."],
  ["Voiture", "Décoration florale du véhicule des mariés."],
  ["Installation", "Livraison et installation sur place, jusqu'à 80 km (déplacement facturé)."],
];

export default async function WeddingPage() {
  const [content, gallery, reviews, settings] = await Promise.all([getContent(), getGallery(), getReviews(), getSettings()]);
  const w = content.wedding;
  return (
    <>
      <PageHero eyebrow="Mariages & événements" title={w.title.split(",")[0]} accent={w.title.includes(",") ? w.title.split(",").slice(1).join(",").trim() : undefined} intro={w.intro} image={w.image} crumbs={[{ href: "/mariage", label: "Mariage" }]} />
      <div className="border-y border-ivory/10 bg-noir py-5">
        <Marquee items={["Bouquet de mariée", "Boutonnières", "Arches & allées", "Centres de table", "Voiture des mariés", "Fleurs de saison"]} itemClassName="font-display text-4xl font-light italic text-ivory/85 sm:text-5xl" />
      </div>

      <section className="fern-paper bg-ivory py-28 text-noir sm:py-36">
        <div className="mx-auto grid max-w-[1600px] gap-16 px-6 sm:px-10 lg:grid-cols-2 lg:px-16">
          <div>
            <SectionTitle eyebrow="Nos prestations" title="Du premier regard" accent="au dernier pétale" tone="light" size="md" />
            <div className="mt-12 grid gap-px overflow-hidden rounded-3xl border border-noir/10 bg-noir/10 sm:grid-cols-2">
              {PRESTA.map(([t, d], i) => (
                <Reveal key={t} delay={(i % 2) * 0.1} className="bg-ivory p-6">
                  <p className="font-caps text-[0.6rem] tracking-[0.3em] text-aubergine-600">{String(i + 1).padStart(2, "0")}</p>
                  <h3 className="mt-3 font-display text-2xl">{t}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-noir/60">{d}</p>
                </Reveal>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <ImageReveal className="col-span-2 aspect-[16/10] rounded-t-[200px]">
              <SmartImage src={IMG.weddingAisle} alt="Allée de cérémonie fleurie" fill sizes="50vw" className="object-cover" />
            </ImageReveal>
            <ImageReveal className="aspect-[3/4] rounded-2xl" delay={0.15}>
              <SmartImage src={IMG.weddingHands} alt="Bouquet de mariée" fill sizes="25vw" className="object-cover" />
            </ImageReveal>
            <ImageReveal className="aspect-[3/4] rounded-2xl" delay={0.3}>
              <SmartImage src={IMG.weddingTable} alt="Table de réception fleurie" fill sizes="25vw" className="object-cover" />
            </ImageReveal>
          </div>
        </div>
      </section>

      <section className="bg-noir py-28 sm:py-36">
        <div className="mx-auto grid max-w-[1600px] gap-16 px-6 sm:px-10 lg:grid-cols-[0.9fr_1.1fr] lg:px-16">
          <div>
            <SectionTitle eyebrow="Notre accompagnement" title="Quatre temps," accent="un seul fil" size="md" />
            <Reveal delay={0.2}>
              <p className="mt-8 max-w-md text-ivory/65">{w.priceNote}</p>
              <p className="mt-4 max-w-md text-sm text-ivory/45">Paiement par carte, virement ou espèces. Acompte de 50 % à la signature du devis, solde la semaine du mariage.</p>
            </Reveal>
          </div>
          <Steps steps={w.steps} tone="dark" />
        </div>
      </section>

      <GalleryGrid items={gallery.filter((g) => g.category === "mariage" || g.category === "evenement").concat(gallery.filter((g) => g.category === "atelier")).slice(0, 8)} instagram={settings.instagram} title="Nos mariages" />
      <Testimonials reviews={reviews} rating={5} count={11} />

      <section id="devis" className="fern-night bg-aubergine-950 py-28 sm:py-36">
        <div className="mx-auto grid max-w-[1400px] gap-16 px-6 sm:px-10 lg:grid-cols-[0.8fr_1.2fr] lg:px-16">
          <div>
            <SectionTitle eyebrow="Demande de devis" title="Racontez-nous" accent="votre jour" size="md" />
            <Reveal delay={0.2}>
              <p className="mt-8 max-w-sm text-ivory/65">Quelques informations suffisent pour un premier échange. Nous revenons vers vous sous 48 h avec nos disponibilités.</p>
              <p className="mt-6 font-display text-2xl">{settings.phone}</p>
            </Reveal>
          </div>
          <ContactForm defaultType="mariage" />
        </div>
      </section>
    </>
  );
}
