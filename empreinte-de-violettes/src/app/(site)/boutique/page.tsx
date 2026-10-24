import type { Metadata } from "next";
import { PageHead } from "@/components/herbier/PageHead";
import { ShopBrowser } from "@/components/shop/ShopBrowser";
import { getCategories, getOccasions, getProducts } from "@/lib/catalog";
import { plateFor } from "@/lib/plates";
import { toSpecimens } from "@/lib/specimen";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "La boutique",
  description: "Bouquets de saison, compositions, plantes, fleurs séchées et créations d'hommage. Livraison à Six-Fours, Sanary, La Seyne et alentours.",
};

export default async function ShopPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const [products, categories, occasions] = await Promise.all([getProducts(), getCategories(), getOccasions()]);
  const cat = categories.find((c) => c.slug === sp.categorie);
  return (
    <>
      <PageHead
        kicker="La boutique"
        folio={`${products.length} planches`}
        title={cat ? cat.name : "Fleurs, plantes"}
        accent={cat ? undefined : "& curiosités"}
        plate={cat ? plateFor({ plate: cat.plate, name: cat.name, id: cat.id }) : "bouquet-ancien"}
      />
      <ShopBrowser
        products={toSpecimens(products, categories)}
        categories={categories.map((c) => ({ id: c.id, slug: c.slug, name: c.name, description: c.description }))}
        occasions={occasions.map((o) => ({ id: o.id, slug: o.slug, name: o.name }))}
        initial={{ categorie: sp.categorie, occasion: sp.occasion, q: sp.q, tri: sp.tri, budget: sp.budget }}
      />
    </>
  );
}
