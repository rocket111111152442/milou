import type { Metadata } from "next";
import { Composer } from "@/components/shop/Composer";
import { PageHero } from "@/components/site/PageHero";
import { getAtelier } from "@/lib/catalog";
import { IMG } from "@/lib/seed";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "L'atelier — composez votre bouquet",
  description: "Choisissez vos fleurs tige par tige et votre emballage : la fleuriste compose votre bouquet à la main.",
};

export default async function AtelierPage() {
  const atelier = await getAtelier();
  return (
    <>
      <PageHero
        eyebrow="L'atelier de composition"
        title="Votre bouquet,"
        accent="tige par tige"
        intro="Choisissez parmi les fleurs et feuillages du moment, regardez votre bouquet prendre forme, puis laissez la fleuriste le composer à la main. Prix calculé en direct."
        image={IMG.handsFern}
        crumbs={[{ href: "/atelier", label: "Atelier" }]}
        compact
      />
      {atelier.enabled ? (
        <Composer atelier={atelier} />
      ) : (
        <section className="bg-paper py-32 text-center text-noir">
          <p className="font-display text-4xl italic">L&apos;atelier est momentanément fermé.</p>
          <p className="mt-3 text-noir/60">Revenez très vite, ou contactez-nous pour une création sur mesure.</p>
        </section>
      )}
    </>
  );
}
