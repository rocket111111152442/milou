import type { Metadata } from "next";
import Link from "next/link";
import { PageHead } from "@/components/herbier/PageHead";
import { Composer } from "@/components/shop/Composer";
import { getAtelier } from "@/lib/catalog";
import { euro } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "L'atelier — composez votre bouquet",
  description: "Choisissez vos fleurs tige par tige et votre emballage : la fleuriste compose votre bouquet à la main.",
};

export default async function AtelierPage() {
  const atelier = await getAtelier();
  return (
    <>
      <PageHead
        kicker="L'atelier"
        folio="sur mesure"
        title="Votre bouquet,"
        accent="tige par tige"
        intro={`Choisissez parmi les fleurs et feuillages du moment ; la planche se compose à mesure. La fleuriste montera ensuite votre bouquet à la main, en spirale. Composition ${euro(atelier.basePrice, { compact: true })}, de ${atelier.minStems} à ${atelier.maxStems} tiges.`}
      />
      {atelier.enabled ? (
        <Composer atelier={atelier} />
      ) : (
        <section className="wrap pb-32 text-center">
          <p className="font-display text-[2.4rem] italic">L&apos;atelier est fermé pour quelques jours.</p>
          <p className="body-text mt-3">Revenez très vite, ou écrivez-nous pour une création sur mesure.</p>
          <Link href="/contact" className="btn-line mt-8">
            Nous écrire <span className="arrow">→</span>
          </Link>
        </section>
      )}
    </>
  );
}
