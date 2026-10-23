"use client";

import { motion } from "framer-motion";
import { ArrowUpRight, Building2, Car, Flower2, HandHeart, Sparkles, Truck } from "lucide-react";
import Link from "next/link";
import { SectionTitle } from "@/components/site/SectionTitle";
import { SmartImage } from "@/components/site/SmartImage";
import { IMG } from "@/lib/seed";

const SERVICES = [
  { icon: Truck, title: "Livraison 6j/7", text: "Nous livrons nous-mêmes Six-Fours, Sanary, La Seyne et alentours, le jour même pour toute commande avant 14 h.", href: "/livraison", image: IMG.kraftBouquet },
  { icon: Car, title: "Retrait & Drive", text: "Retrait gratuit en boutique, ou Drive : appelez-nous en arrivant, nous vous apportons vos fleurs à la voiture.", href: "/livraison#retrait", image: IMG.shopFront },
  { icon: Sparkles, title: "Mariages", text: "Bouquet de mariée, boutonnières, cérémonie, réception et voiture : un univers floral sur mesure.", href: "/mariage", image: IMG.brideDark },
  { icon: HandHeart, title: "Deuil & hommage", text: "Couronnes, gerbes et dessus de cercueil livrés aux funérariums, églises et cimetières.", href: "/deuil", image: IMG.whiteRoseDark },
  { icon: Building2, title: "Entreprises", text: "Compositions d'accueil, abonnements floraux hebdomadaires, événements et cadeaux clients.", href: "/contact?type=entreprise", image: IMG.leavesDark },
  { icon: Flower2, title: "Plantes rares", text: "Une sélection de plantes vertes et de curiosités botaniques, conseillées et rempotées avec soin.", href: "/boutique?categorie=plantes", image: IMG.monsteraDark },
];

export function Services() {
  return (
    <section id="services" className="relative bg-noir py-28 sm:py-36">
      <div className="mx-auto max-w-[1600px] px-6 sm:px-10 lg:px-16">
        <SectionTitle eyebrow="Nos services" title="Tout ce qui fleurit," accent="sous un même toit" />
        <div className="mt-16 grid gap-px overflow-hidden rounded-[2rem] border border-ivory/10 bg-ivory/10 sm:grid-cols-2 lg:grid-cols-3">
          {SERVICES.map((s, i) => (
            <motion.div
              key={s.title}
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.9, delay: (i % 3) * 0.12 }}
            >
              <Link href={s.href} className="group relative flex h-full min-h-[320px] flex-col justify-between overflow-hidden bg-noir p-8 sm:p-10" data-cursor="link">
                <div className="absolute inset-0 transition-[clip-path] duration-[900ms] ease-silk [clip-path:circle(0%_at_90%_10%)] group-hover:[clip-path:circle(150%_at_90%_10%)]">
                  <SmartImage src={s.image} alt="" fill sizes="(max-width: 1024px) 50vw, 33vw" className="object-cover" />
                  <div className="absolute inset-0 bg-aubergine-950/75" />
                </div>
                <div className="relative flex items-start justify-between">
                  <span className="flex h-14 w-14 items-center justify-center rounded-full border border-gold/40 text-gold transition duration-500 group-hover:bg-gold group-hover:text-noir">
                    <s.icon className="h-6 w-6" strokeWidth={1.2} />
                  </span>
                  <span className="font-caps text-[0.6rem] tracking-[0.3em] text-ivory/35">{String(i + 1).padStart(2, "0")}</span>
                </div>
                <div className="relative">
                  <h3 className="flex items-center gap-3 font-display text-3xl sm:text-4xl">
                    {s.title}
                    <ArrowUpRight className="h-5 w-5 -translate-x-2 opacity-0 transition duration-500 group-hover:translate-x-0 group-hover:opacity-100" />
                  </h3>
                  <p className="mt-3 max-w-sm text-sm leading-relaxed text-ivory/60 transition group-hover:text-ivory/85">{s.text}</p>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
