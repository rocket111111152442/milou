import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Fade, RunningHead, Words } from "@/components/herbier/Elements";
import { Plate } from "@/components/herbier/Plate";
import { Specimen } from "@/components/herbier/Specimen";
import { ProductView } from "@/components/shop/ProductView";
import { getAddons, getCategories, getDelivery, getProduct, getProducts } from "@/lib/catalog";
import { euro, hhmm } from "@/lib/format";
import { siteUrl } from "@/lib/orders";
import { PLATES, plateFor } from "@/lib/plates";
import { toSpecimens } from "@/lib/specimen";

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
  const specimens = toSpecimens(products, categories);
  const number = specimens.findIndex((s) => s.id === product.id) + 1;
  const plate = plateFor(product);
  const related = specimens.filter((p) => p.id !== product.id && p.categoryId === product.categoryId).slice(0, 3);

  const zones = delivery.zones.filter((x) => x.active);
  const minFee = zones.length ? Math.min(...zones.map((x) => x.fee)) : 0;
  const notes: [string, string][] = [
    product.pickupOnly ? ["Réception", "retrait en boutique ou Drive"] : ["Livraison", `dès ${euro(minFee, { compact: true })} · le jour même avant ${hhmm(delivery.sameDayCutoff)}`],
    ["Retrait en boutique", product.deliveryOnly ? "non disponible" : "gratuit"],
    ["Carte manuscrite", "offerte"],
    ["Paiement", "sécurisé par Stripe"],
  ];

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
      <ProductView product={product} category={category?.name || "Création"} addons={addons} notes={notes} number={number} plate={plate} />

      <section className="h-paper-deep py-24 sm:py-32">
        <div className="wrap grid items-center gap-14 lg:grid-cols-12 lg:gap-10">
          <div className="lg:col-span-5 lg:col-start-2">
            <Plate name={plate} duration={2.6} className="mx-auto w-[min(420px,85%)] text-plum" />
          </div>
          <div className="lg:col-span-5 lg:col-start-8">
            <p className="sc text-ink-muted">La planche</p>
            <h2 className="h-section mt-5">
              <Words text={product.name} /> <em><Words text="à l'encre" delay={0.1} /></em>
            </h2>
            <Fade delay={0.2}>
              <p className="body-text mt-6">
                Chaque création de la Maison a sa planche dans notre herbier : une gravure botanique ancienne, choisie pour la fleur qui la porte.
              </p>
              <p className="folio mt-6 text-ink-muted">{PLATES[plate].title}. Wellcome Collection, domaine public.</p>
            </Fade>
          </div>
        </div>
      </section>

      {related.length > 0 && (
        <section className="wrap py-24 sm:py-28">
          <RunningHead left="Dans le même esprit" right={category?.name} />
          <div className="mt-14 grid gap-x-8 gap-y-14 sm:grid-cols-2 lg:grid-cols-3 lg:gap-x-12">
            {related.map((p, i) => (
              <Fade key={p.id} delay={i * 0.1}>
                <Specimen p={p} hover="plate" />
              </Fade>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
