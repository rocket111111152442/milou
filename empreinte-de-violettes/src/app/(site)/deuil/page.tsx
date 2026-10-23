import type { Metadata } from "next";
import { Church, Clock, HandHeart, Truck } from "lucide-react";
import { Reveal } from "@/components/motion/Reveal";
import { ContactForm } from "@/components/site/ContactForm";
import { PageHero } from "@/components/site/PageHero";
import { ProductCard } from "@/components/site/ProductCard";
import { SectionTitle } from "@/components/site/SectionTitle";
import { getContent, getProducts, getSettings } from "@/lib/catalog";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Deuil & hommage",
  description: "Bouquets de deuil, gerbes, couronnes, coussins et dessus de cercueil livrés aux funérariums, églises et cimetières de Six-Fours, Sanary, La Seyne et Toulon.",
};

export default async function FuneralPage() {
  const [content, products, settings] = await Promise.all([getContent(), getProducts(), getSettings()]);
  const items = products.filter((p) => p.categoryId === "cat_deuil" || p.occasionIds.includes("occ_deuil") || p.occasionIds.includes("occ_toussaint"));
  const f = content.funeral;
  return (
    <>
      <PageHero eyebrow="Deuil & hommage" title={f.title} accent="avec délicatesse" intro={f.intro} image={f.image} crumbs={[{ href: "/deuil", label: "Deuil" }]} />
      <section className="fern-paper bg-ivory py-20 text-noir">
        <div className="mx-auto grid max-w-[1600px] gap-6 px-6 sm:grid-cols-2 sm:px-10 lg:grid-cols-4 lg:px-16">
          {[
            [Truck, "Livraison dédiée", "Funérariums, églises, cimetières et domicile de la famille."],
            [Clock, "Dans l'urgence", "Commande le jour même avant 14 h, ou par téléphone."],
            [Church, "Ruban personnalisé", "Indiquez le texte souhaité dans votre message."],
            [HandHeart, "Écoute & conseil", `Appelez-nous au ${settings.phone}, nous vous guidons.`],
          ].map(([Icon, t, d], i) => {
            const I = Icon as typeof Truck;
            return (
              <Reveal key={t as string} delay={i * 0.08} className="rounded-3xl border border-noir/10 bg-white/60 p-7">
                <I className="h-7 w-7 text-aubergine-600" strokeWidth={1.2} />
                <h3 className="mt-5 font-display text-2xl">{t as string}</h3>
                <p className="mt-2 text-sm text-noir/60">{d as string}</p>
              </Reveal>
            );
          })}
        </div>
      </section>
      <section className="bg-noir py-28">
        <div className="mx-auto max-w-[1600px] px-6 sm:px-10 lg:px-16">
          <SectionTitle eyebrow="Nos créations d'hommage" title="Fleurir" accent="le souvenir" size="md" />
          <div className="mt-14 grid grid-cols-1 gap-x-8 gap-y-16 sm:grid-cols-2 lg:grid-cols-4">
            {items.map((p, i) => (
              <ProductCard key={p.id} product={p} index={i} />
            ))}
          </div>
        </div>
      </section>
      <section className="fern-night bg-aubergine-950 py-28">
        <div className="mx-auto grid max-w-[1400px] gap-16 px-6 sm:px-10 lg:grid-cols-[0.8fr_1.2fr] lg:px-16">
          <div>
            <SectionTitle eyebrow="Une composition sur mesure" title="Nous sommes" accent="à vos côtés" size="md" />
            <p className="mt-8 max-w-sm text-ivory/65">Pour une pièce particulière, des couleurs précises ou une livraison délicate, écrivez-nous : nous vous rappelons rapidement.</p>
          </div>
          <ContactForm defaultType="deuil" lockType />
        </div>
      </section>
    </>
  );
}
