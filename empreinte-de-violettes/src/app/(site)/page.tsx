import { AvantPropos } from "@/components/herbier/home/AvantPropos";
import { Almanach } from "@/components/herbier/home/Almanach";
import { Cover } from "@/components/herbier/home/Cover";
import { Diptyque } from "@/components/herbier/home/Diptyque";
import { Geste } from "@/components/herbier/home/Geste";
import { Lettres } from "@/components/herbier/home/Lettres";
import { Planches } from "@/components/herbier/home/Planches";
import { Rayons, type Rayon } from "@/components/herbier/home/Rayons";
import { Recevoir } from "@/components/herbier/home/Recevoir";
import { Visite } from "@/components/herbier/home/Visite";
import { getCategories, getContent, getDelivery, getGallery, getProducts, getReviews, getSettings } from "@/lib/catalog";
import { parisNow } from "@/lib/delivery";
import { plateFor } from "@/lib/plates";
import { IMG } from "@/lib/seed";
import { toSpecimens } from "@/lib/specimen";

export const dynamic = "force-dynamic";

/** 43.0988 → « 43° 05′ 56″ N » */
const dms = (v: number, pos: string, neg: string) => {
  const a = Math.abs(v);
  const d = Math.floor(a);
  const m = Math.floor((a - d) * 60);
  const s = Math.round(((a - d) * 60 - m) * 60);
  return `${d}° ${String(m).padStart(2, "0")}′ ${String(s).padStart(2, "0")}″ ${v >= 0 ? pos : neg}`;
};

/** Première idée d'une description, en 50 signes au plus, coupée à une virgule ou entre deux mots. */
function shortNote(text: string, max = 50) {
  let t = text.split(/[.:]/)[0].trim();
  while (t.length > max && t.includes(",")) t = t.slice(0, t.lastIndexOf(",")).trim();
  if (t.length > max) t = t.slice(0, t.lastIndexOf(" ", max)).trim();
  return t;
}

export default async function HomePage() {
  const [settings, content, products, categories, reviews, gallery, delivery] = await Promise.all([
    getSettings(),
    getContent(),
    getProducts(),
    getCategories(),
    getReviews(),
    getGallery(),
    getDelivery(),
  ]);
  const specimens = toSpecimens(products, categories);
  const featured = [...specimens.filter((p) => p.featured), ...specimens.filter((p) => !p.featured)].slice(0, 6);

  const count = (n: number) => `${n} création${n > 1 ? "s" : ""}`;
  const rayons: Rayon[] = categories.map((c) => ({
    href: `/boutique?categorie=${c.slug}`,
    name: c.name,
    note: shortNote(c.description),
    count: count(products.filter((p) => p.categoryId === c.id).length),
    image: c.image,
    plate: plateFor({ plate: c.plate, name: c.name, id: c.id }),
  }));
  rayons.push(
    { href: "/atelier", name: "L'atelier", note: "composer son bouquet tige par tige", count: "sur mesure", image: content.manifesto.image, plate: "renoncule" },
    { href: "/mariage", name: "Mariages", note: "bouquet, cérémonie, réception", count: "sur devis", image: content.wedding.image, plate: "lys" },
  );

  const now = parisNow();
  const month = Number(now.date.slice(5, 7)) - 1;
  const target = content.seasonal.targetDate ? content.seasonal.targetDate.slice(0, 10) : null;
  const daysTo = target ? Math.round((Date.parse(target) - Date.parse(now.date)) / 86_400_000) : null;
  const pick = (cat: string, fallback: string) => gallery.find((g) => g.category === cat)?.image || fallback;

  return (
    <>
      <Cover
        introEnabled={settings.intro.enabled}
        oncePerSession={settings.intro.oncePerSession}
        coords={`${dms(settings.lat, "N", "S")} — ${dms(settings.lng, "E", "O")}`}
        founded={content.hero.eyebrow}
        tagline={content.hero.subtitle}
        cta={content.hero.ctaLabel}
      />
      <AvantPropos content={content} image={content.hero.images[0] || IMG.dahliaDark} caption="Dans l'atelier." />
      <Rayons rayons={rayons} />
      <Planches products={featured} total={products.length} />
      <Almanach seasonal={{ ...content.seasonal, active: content.seasonal.active && (daysTo == null || daysTo >= 0) }} month={month} daysTo={daysTo} />
      <Geste label={content.manifesto.eyebrow} text={content.manifesto.text} signature={content.manifesto.signature} image={content.manifesto.image} />
      <Recevoir delivery={delivery} />
      <Lettres reviews={reviews.map((r) => ({ id: r.id, author: r.author, text: r.text, source: r.source }))} rating={settings.googleRating} count={settings.googleReviews} />
      <Diptyque content={content} weddingImage={content.wedding.image || pick("mariage", IMG.brideDark)} funeralImage={content.funeral.image || pick("deuil", IMG.whiteRoseDark)} />
      <Visite settings={settings} image={content.about.image || IMG.shopFront} />
    </>
  );
}
