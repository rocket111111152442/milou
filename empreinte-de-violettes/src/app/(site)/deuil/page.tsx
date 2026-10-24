import type { Metadata } from "next";
import { ContactForm } from "@/components/herbier/ContactForm";
import { Fade, RunningHead, Words } from "@/components/herbier/Elements";
import { PageHead } from "@/components/herbier/PageHead";
import { Specimen } from "@/components/herbier/Specimen";
import { getCategories, getContent, getDelivery, getProducts, getSettings } from "@/lib/catalog";
import { hhmm } from "@/lib/format";
import { toSpecimens } from "@/lib/specimen";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Deuil & hommage",
  description: "Bouquets de deuil, gerbes, couronnes, coussins et dessus de cercueil livrés aux funérariums, églises et cimetières de Six-Fours, Sanary, La Seyne et Toulon.",
};

export default async function FuneralPage() {
  const [content, products, categories, settings, delivery] = await Promise.all([getContent(), getProducts(), getCategories(), getSettings(), getDelivery()]);
  const items = toSpecimens(products, categories).filter((p) => p.categoryId === "cat_deuil" || p.occasionIds.includes("occ_deuil") || p.occasionIds.includes("occ_toussaint"));
  const f = content.funeral;
  const notes: [string, string][] = [
    ["Livraison dédiée", "funérariums, églises, cimetières, domicile"],
    ["Dans l'urgence", `commande le jour même avant ${hhmm(delivery.sameDayCutoff)}`],
    ["Ruban personnalisé", "texte à préciser dans votre message"],
    ["Conseil", `par téléphone au ${settings.phone}`],
  ];
  return (
    <>
      <PageHead kicker="Deuil & hommage" folio="avec délicatesse" title={f.title} intro={f.intro} plate="anemone-lys">
        <Fade delay={0.35} className="mt-10 max-w-2xl space-y-2.5 font-text text-[1.02rem]">
          {notes.map(([a, b]) => (
            <div key={a} className="flex items-baseline">
              <span>{a}</span>
              <span className="leader" />
              <span className="text-right italic text-ink-soft">{b}</span>
            </div>
          ))}
        </Fade>
      </PageHead>

      {items.length > 0 && (
        <section className="wrap pb-24">
          <RunningHead left="Créations d'hommage" right={`${items.length} planches`} />
          <div className="mt-12 grid gap-x-8 gap-y-14 sm:grid-cols-2 lg:grid-cols-3 lg:gap-x-12">
            {items.map((p, i) => (
              <Fade key={p.id} delay={(i % 3) * 0.1}>
                <Specimen p={p} />
              </Fade>
            ))}
          </div>
        </section>
      )}

      <section className="h-night py-24 sm:py-32">
        <div className="wrap grid gap-14 lg:grid-cols-12 lg:gap-10">
          <div className="lg:col-span-4">
            <p className="sc text-paper/50">Une composition sur mesure</p>
            <h2 className="h-section mt-6">
              <Words text="Nous sommes" /> <em><Words text="à vos côtés" delay={0.1} /></em>
            </h2>
            <p className="mt-6 font-text text-[1.05rem] leading-relaxed text-paper/70">Pour une pièce particulière, des couleurs précises ou une livraison délicate, appelez-nous ou écrivez-nous : nous vous rappelons rapidement.</p>
            <a href={`tel:${settings.phone.replace(/\s/g, "")}`} className="tab mt-6 inline-block font-display text-[1.9rem] hover:italic">
              {settings.phone}
            </a>
          </div>
          <div className="text-ink lg:col-span-7 lg:col-start-6">
            <ContactForm defaultType="deuil" lockType />
          </div>
        </div>
      </section>
    </>
  );
}
