import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductCard } from "@/components/site/ProductCard";
import { SectionTitle } from "@/components/site/SectionTitle";
import { ProductView } from "@/components/shop/ProductView";
import { getAddons, getCategories, getDelivery, getProduct, getProducts } from "@/lib/catalog";
import { euro } from "@/lib/format";
import { siteUrl } from "@/lib/orders";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const p = await getProduct(slug);
  if (!p) return { title: "Création introuvable" };
  const img = p.images[0]?.startsWith("https://images.unsplash.com") ? `${p.images[0].split("?")[0]}?w=1200&q=75` : p.images[0];
  return {
    title: `${p.name} — ${p.subtitle}`,
    description: p.description.slice(0, 160),
    openGraph: { title: p.name, description: p.subtitle, images: img && !img.startsWith("data:") ? [img] : [] },
  };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [product, products, categories, addons, delivery] = await Promise.all([getProduct(slug), getProducts(), getCategories(), getAddons(), getDelivery()]);
  if (!product) notFound();
  const category = categories.find((c) => c.id === product.categoryId);
  const related = products.filter((p) => p.id !== product.id && p.categoryId === product.categoryId).slice(0, 4);
  const z = delivery.zones.filter((x) => x.active);
  const minFee = Math.min(...z.map((x) => x.fee));
  const deliveryHint = product.pickupOnly
    ? "Disponible en retrait boutique et Drive"
    : `Livraison dès ${euro(minFee, { compact: true })} · jour même avant ${delivery.sameDayCutoff.replace(":", " h ").replace(" h 00", " h")}`;
  const fromPrice = product.variants.length ? Math.min(...product.variants.map((v) => v.price)) : product.price;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    image: product.images.filter((i) => !i.startsWith("data:")),
    brand: { "@type": "Brand", name: "Empreinte de Violettes" },
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "EUR",
      lowPrice: (fromPrice / 100).toFixed(2),
      highPrice: (Math.max(product.price, ...product.variants.map((v) => v.price)) / 100).toFixed(2),
      availability: product.stock === 0 ? "https://schema.org/OutOfStock" : "https://schema.org/InStock",
      url: `${siteUrl()}/boutique/${product.slug}`,
    },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <ProductView product={product} category={category?.name || "Création"} addons={addons} deliveryHint={deliveryHint} />
      {related.length > 0 && (
        <section className="border-t border-ivory/10 bg-noir py-24">
          <div className="mx-auto max-w-[1600px] px-6 sm:px-10 lg:px-16">
            <SectionTitle eyebrow="Dans le même esprit" title="Vous aimerez" accent="aussi" size="md" />
            <div className="mt-14 grid grid-cols-1 gap-x-8 gap-y-16 sm:grid-cols-2 lg:grid-cols-4">
              {related.map((p, i) => (
                <ProductCard key={p.id} product={p} index={i} />
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
