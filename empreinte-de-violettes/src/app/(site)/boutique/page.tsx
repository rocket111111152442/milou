import type { Metadata } from "next";
import { ShopBrowser } from "@/components/shop/ShopBrowser";
import { PageHero } from "@/components/site/PageHero";
import { getCategories, getOccasions, getProducts } from "@/lib/catalog";
import { IMG } from "@/lib/seed";

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
      <PageHero
        eyebrow={cat ? "La boutique" : "Fleurs de saison · fait main"}
        title={cat ? cat.name : "La boutique"}
        accent={cat ? undefined : "de la Maison"}
        intro={cat?.description || "Chaque création est composée à la main le jour de la livraison, avec des fleurs locales et de saison. Les photos sont indicatives : votre bouquet sera unique."}
        image={cat?.image || IMG.darkRed}
        crumbs={[{ href: "/boutique", label: "Boutique" }]}
        compact
      />
      <ShopBrowser
        products={products.map((p) => ({
          id: p.id,
          slug: p.slug,
          name: p.name,
          subtitle: p.subtitle,
          price: p.price,
          images: p.images,
          variants: p.variants,
          isNew: p.isNew,
          seasonal: p.seasonal,
          stock: p.stock,
          star: p.star,
          compareAtPrice: p.compareAtPrice,
          categoryId: p.categoryId,
          occasionIds: p.occasionIds,
          featured: p.featured,
          description: p.description,
          sortOrder: p.sortOrder,
          tags: p.tags,
        }))}
        categories={categories.map((c) => ({ id: c.id, slug: c.slug, name: c.name }))}
        occasions={occasions.map((o) => ({ id: o.id, slug: o.slug, name: o.name }))}
        initial={{ categorie: sp.categorie, occasion: sp.occasion, q: sp.q, tri: sp.tri, max: sp.max }}
      />
    </>
  );
}
