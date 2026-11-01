import type { Metadata } from "next";
import { HeroBanner } from "@waverti/ui";
import { requireUser } from "@/lib/auth";
import { ProductSearchGuide } from "./product-search-guide";

export const metadata: Metadata = { title: "Rechercher un produit" };

export default async function ProductSearchPage() {
  await requireUser("/app/produits");
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <HeroBanner
        title="Trouvez le meilleur prix"
        description="Dites-nous quel produit vous intéresse. Nous vous aidons à le suivre dans les boutiques."
      />
      <ProductSearchGuide />
    </div>
  );
}
