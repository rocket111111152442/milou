import type { Metadata } from "next";
import Image from "next/image";
import { PageHero, SectionTitle, CTABand } from "@/components/ui";
import { Parallax, Reveal, Stagger, StaggerItem } from "@/components/motion";
import { Blob, Star, Wave } from "@/components/decor";
import { Marquee } from "@/components/Marquee";
import { RequestForm } from "@/components/RequestForm";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Brunch, coffee shop & salon de thé à La Seyne-sur-Mer",
  description:
    "Brunchs gourmands, cookies maison, petite restauration fraîche et de saison : le coffee shop familial Chouet'House à La Seyne-sur-Mer. Sur place, à emporter ou en livraison. Réservez votre table en ligne.",
  alternates: { canonical: "/restaurant-brunch" },
};

const MENU = [
  {
    title: "Les brunchs",
    text: "Sucré, salé ou les deux : pancakes, tartines, œufs, fruits frais… le rendez-vous gourmand à partager en famille ou entre amis.",
    img: "/images/pancakes.webp",
    pos: "50% 85%",
    tag: "Brunch",
    color: "bg-tomato",
  },
  {
    title: "Petite restauration de saison",
    text: "Une cuisine fraîche qui suit les saisons : assiettes, tartines et plats légers pour le déjeuner, à déguster sur place ou à emporter.",
    img: "/images/toast-avocat.webp",
    tag: "Fait maison",
    color: "bg-sage-deep",
  },
  {
    title: "Cookies & douceurs maison",
    text: "Nos cookies maison, préparés avec amour, et des douceurs pour le goûter des petits… et des grands.",
    img: "/images/table-brunch.webp",
    tag: "Goûter",
    color: "bg-mustard",
  },
  {
    title: "Boissons gourmandes",
    text: "Cafés, thés, chocolats chauds, smoothies et milkshakes : de quoi se réchauffer l'hiver et se rafraîchir l'été.",
    img: "/images/smoothies.webp",
    tag: "Coffee shop",
    color: "bg-coral",
  },
];

const HOURS = ["09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00", "12:30", "13:00", "13:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00"];

export default function RestaurantPage() {
  return (
    <>
      <PageHero
        eyebrow="Restauration · Coffee shop"
        title="Brunchs, cookies & douceurs maison"
        intro={
          <p>
            Chouet&apos;House vous propose de la <strong className="text-ink">petite restauration fraîche et de saison</strong>, de délicieux brunchs et des cookies
            maison, préparés avec amour pour régaler petits et grands. Le tout dans un salon de thé lumineux pensé pour les familles.
          </p>
        }
        image="/images/table-brunch.webp"
        imageAlt="Table de brunch dressée chez Chouet'House à La Seyne-sur-Mer"
        color="butter"
      >
        <a href="#reserver" className="btn-primary">Réserver une table</a>
        <a href={`tel:${SITE.phoneHref}`} className="btn-ghost">📞 {SITE.phone}</a>
      </PageHero>

      <section className="container-x py-20">
        <SectionTitle eyebrow="À la carte" title="Ce qui vous attend à table" intro="La carte évolue au fil des saisons : demandez-nous les suggestions du jour !" />
        <div className="mt-16 space-y-24">
          {MENU.map((m, i) => (
            <div key={m.title} className={`grid items-center gap-10 md:grid-cols-2 ${i % 2 ? "md:[&>*:first-child]:order-2" : ""}`}>
              <Reveal x={i % 2 ? 40 : -40} y={0}>
                <Parallax offset={30}>
                  <div className="relative aspect-[4/3] overflow-hidden rounded-[2.5rem] shadow-2xl ring-8 ring-white">
                    <Image src={m.img} alt={m.title} fill sizes="(min-width:768px) 50vw, 100vw" className="object-cover transition duration-700 hover:scale-105" style={{ objectPosition: (m as { pos?: string }).pos ?? "50% 50%" }} />
                  </div>
                </Parallax>
              </Reveal>
              <Reveal delay={0.1}>
                <span className={`inline-block rounded-full ${m.color} px-4 py-1 text-sm font-extrabold tracking-wide text-white uppercase`}>{m.tag}</span>
                <h3 className="mt-4 text-4xl font-semibold sm:text-5xl">{m.title}</h3>
                <p className="mt-4 text-lg text-ink-soft">{m.text}</p>
              </Reveal>
            </div>
          ))}
        </div>
      </section>

      <div className="rotate-1 bg-sage-deep py-5 text-white">
        <Marquee items={["Sur place", "À emporter", "Livraison", "Fait maison", "Produits de saison", "Family friendly"]} reverse />
      </div>

      <section className="container-x py-24">
        <Stagger className="grid gap-5 sm:grid-cols-3">
          {[
            { e: "🪑", t: "Sur place", d: "Une salle lumineuse et chaleureuse, pensée pour les familles." },
            { e: "🥡", t: "À emporter", d: "Envie d'un brunch à la maison ou d'un cookie sur le pouce ? Passez commande." },
            { e: "🛵", t: "Livraison", d: "Vos gourmandises Chouet'House livrées chez vous." },
          ].map((x) => (
            <StaggerItem key={x.t}>
              <div className="card h-full p-8 text-center transition duration-500 hover:-translate-y-2">
                <span className="text-5xl">{x.e}</span>
                <h3 className="mt-4 text-2xl font-semibold">{x.t}</h3>
                <p className="mt-2 text-ink-soft">{x.d}</p>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      <section id="reserver" className="relative scroll-mt-24 bg-shell">
        <Wave color="var(--color-shell)" flip className="absolute -top-[49px] sm:-top-[79px]" />
        <Blob className="top-20 -right-24 h-80 w-80 opacity-40" color="var(--color-coral)" />
        <Star className="top-16 left-[6%] h-10 w-10 animate-float" />
        <div className="container-x relative grid gap-12 py-24 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <SectionTitle
              align="left"
              eyebrow="Réservation"
              title="Réservez votre table"
              intro="Sélectionnez vos détails et nous ferons notre possible pour satisfaire votre demande. Nous vous confirmons par téléphone ou e-mail."
            />
            <Reveal delay={0.2}>
              <div className="mt-8 rounded-3xl bg-white/70 p-6">
                <p className="font-bold">📍 Avenue Pierre Auguste Renoir</p>
                <p className="mt-1">🕘 {SITE.hours}</p>
                <p className="mt-1">
                  📞 Pressé ? <a className="font-bold underline" href={`tel:${SITE.phoneHref}`}>{SITE.phone}</a>
                </p>
              </div>
            </Reveal>
          </div>
          <Reveal delay={0.1} className="card p-6 sm:p-10 lg:col-span-3">
            <RequestForm
              type="reservation-table"
              submitLabel="Demander ma réservation"
              successTitle="Demande bien reçue !"
              successText="Nous revenons vers vous rapidement pour confirmer votre table."
              fields={[
                { name: "date", label: "Date", type: "date", required: true, half: true },
                { name: "heure", label: "Heure", type: "select", options: HOURS, required: true, half: true, defaultValue: "10:00" },
                { name: "personnes", label: "Adultes", type: "number", required: true, half: true, defaultValue: "2", min: 1 },
                { name: "enfants", label: "Enfants", type: "number", half: true, defaultValue: "0", min: 0 },
                { name: "name", label: "Nom et prénom", required: true, half: true },
                { name: "phone", label: "Téléphone", type: "tel", required: true, half: true },
                { name: "email", label: "E-mail", type: "email" },
                { name: "message", label: "Une précision ? (chaise haute, allergie, anniversaire…)", type: "textarea" },
              ]}
            />
          </Reveal>
        </div>
      </section>

      <CTABand title="Et pendant que vous savourez…" text="…les enfants peuvent profiter de nos ateliers d'éveil, de danse ou de pâtisserie !">
        <a href="/ateliers-enfants" className="btn-yellow">Voir les ateliers</a>
      </CTABand>
    </>
  );
}
