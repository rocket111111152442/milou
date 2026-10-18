import type { Metadata } from "next";
import Image from "next/image";
import { CATEGORIES, type CategoryId } from "@/lib/catalog";
import { MenuBrowser } from "@/components/menu/MenuBrowser";
import { SplitWords } from "@/components/ui/motion";

export const metadata: Metadata = {
  title: "La carte & commande en ligne",
  description:
    "Pains, viennoiseries, pâtisseries, gâteaux à partager, snacking et boissons : composez votre commande et récupérez-la au Pétrin de Pépiole, à Sanary-sur-Mer.",
  alternates: { canonical: "/carte" },
};

export default async function CartePage({ searchParams }: { searchParams: Promise<{ rayon?: string }> }) {
  const { rayon } = await searchParams;
  const initial = CATEGORIES.some((c) => c.id === rayon) ? (rayon as CategoryId) : "tout";

  return (
    <>
      <section className="grain relative overflow-hidden bg-torref pb-20 pt-40 text-creme">
        <Image src="/images/hero-pains.jpg" alt="" fill priority sizes="100vw" className="object-cover opacity-35" />
        <div className="absolute inset-0 bg-gradient-to-t from-torref to-torref/30" />
        <div className="relative z-10 mx-auto max-w-7xl px-6">
          <p className="font-script text-4xl text-dore">Commande & retrait en boutique</p>
          <SplitWords as="h1" immediate text="La carte du fournil" className="mt-2 block font-display text-6xl leading-none tracking-tight sm:text-8xl" />
          <ol className="mt-10 grid max-w-3xl gap-3 text-sm sm:grid-cols-3">
            {["Remplissez votre panier", "Choisissez un créneau de retrait", "Payez en boutique en récupérant"].map((s, i) => (
              <li key={s} className="flex items-center gap-3 rounded-2xl border border-creme/15 bg-creme/5 px-4 py-3 backdrop-blur">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-dore font-bold text-torref">{i + 1}</span>
                {s}
              </li>
            ))}
          </ol>
        </div>
      </section>
      <section className="bg-farine px-6 pb-32">
        <div className="mx-auto max-w-7xl">
          <MenuBrowser initial={initial} />
          <p className="mt-16 max-w-3xl text-xs leading-relaxed text-grege">
            Prix TTC, susceptibles d&apos;évoluer selon les saisons. Photos non contractuelles. Pour toute question sur les
            allergènes, renseignez-vous en boutique : la liste des allergènes est disponible sur simple demande.
          </p>
        </div>
      </section>
    </>
  );
}
