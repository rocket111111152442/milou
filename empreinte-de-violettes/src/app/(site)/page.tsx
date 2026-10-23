import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AtelierTeaser } from "@/components/home/AtelierTeaser";
import { Constellation } from "@/components/home/Constellation";
import { Featured } from "@/components/home/Featured";
import { GalleryGrid } from "@/components/home/GalleryGrid";
import { Hero } from "@/components/home/Hero";
import { Manifesto } from "@/components/home/Manifesto";
import { Seasonal } from "@/components/home/Seasonal";
import { Services } from "@/components/home/Services";
import { Testimonials } from "@/components/home/Testimonials";
import { Univers } from "@/components/home/Univers";
import { Visit } from "@/components/home/Visit";
import { WeddingTeaser } from "@/components/home/WeddingTeaser";
import { Marquee } from "@/components/motion/Marquee";
import { FaqList } from "@/components/site/FaqList";
import { SectionTitle } from "@/components/site/SectionTitle";
import { getAtelier, getCategories, getContent, getFaqs, getGallery, getProducts, getReviews, getSettings } from "@/lib/catalog";
import { euro } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [settings, content, products, categories, reviews, faqs, gallery, atelier] = await Promise.all([
    getSettings(),
    getContent(),
    getProducts(),
    getCategories(),
    getReviews(),
    getFaqs(),
    getGallery(),
    getAtelier(),
  ]);
  const cardProducts = products.map((p) => ({
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
    featured: p.featured,
  }));
  const univers = categories.map((c) => ({ href: `/boutique?categorie=${c.slug}`, title: c.name, text: c.description, image: c.image }));
  univers.splice(2, 0, { href: "/mariage", title: "Mariages", text: content.wedding.intro.slice(0, 110) + "…", image: content.wedding.image });

  return (
    <>
      <Hero content={content} settings={settings} />
      <div className="border-y border-ivory/10 bg-noir py-6">
        <Marquee items={content.marquee} itemClassName="font-display text-[clamp(1.8rem,4vw,3.6rem)] font-light italic text-ivory/90" />
      </div>
      <Manifesto content={content} />
      <Featured products={cardProducts} categories={categories.map((c) => ({ id: c.id, name: c.name }))} />
      <Seasonal seasonal={content.seasonal} />
      <Constellation products={cardProducts.filter((p) => p.categoryId !== "cat_deuil")} />
      <Univers items={univers} />
      {atelier.enabled && <AtelierTeaser basePrice={euro(atelier.basePrice, { compact: true })} />}
      <Services />
      <WeddingTeaser wedding={content.wedding} images={gallery.filter((g) => g.category === "mariage").map((g) => g.image)} />
      <Testimonials reviews={reviews} rating={settings.googleRating} count={settings.googleReviews} />
      <GalleryGrid items={gallery} instagram={settings.instagram} />
      <Visit settings={settings} />
      <section className="fern-paper bg-ivory py-28 text-noir sm:py-36">
        <div className="mx-auto grid max-w-[1600px] gap-14 px-6 sm:px-10 lg:grid-cols-[0.8fr_1.4fr] lg:px-16">
          <div>
            <SectionTitle eyebrow="Questions fréquentes" title="Bon à" accent="savoir" tone="light" size="md" />
            <Link href="/faq" className="btn btn-ghost-dark mt-10">
              <span>Toutes les questions</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <FaqList faqs={faqs.slice(0, 5)} />
        </div>
      </section>
    </>
  );
}
