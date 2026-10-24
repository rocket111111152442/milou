import Link from "next/link";
import { cn } from "@/lib/cn";
import { Fade, RunningHead, Words } from "../Elements";
import { Specimen, type SpecimenProduct } from "../Specimen";

/** Sélection de la Maison : six planches, la colonne du milieu décalée comme dans un album. */
export function Planches({ products, total }: { products: SpecimenProduct[]; total: number }) {
  return (
    <section className="wrap py-24 sm:py-32">
      <RunningHead left="Planches choisies" right="III" />
      <div className="mt-14 flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
        <h2 className="h-section max-w-[16ch]">
          <Words text="Les créations" /> <em><Words text="du moment" delay={0.1} /></em>
        </h2>
        <Fade className="max-w-sm">
          <p className="body-text">Composées le jour même avec les arrivages du matin. Passez sur une planche : le bouquet redevient gravure.</p>
        </Fade>
      </div>
      <div className="mt-16 grid gap-x-8 gap-y-14 sm:grid-cols-2 lg:grid-cols-3 lg:gap-x-12">
        {products.map((p, i) => (
          <Fade key={p.id} delay={(i % 3) * 0.12} className={cn(i % 3 === 1 && "lg:mt-24")}>
            <Specimen p={p} hover="plate" priority={i < 3} />
          </Fade>
        ))}
      </div>
      <div className="mt-20 flex justify-center lg:mt-36">
        <Link href="/boutique" className="btn-label">
          <span>Voir les {total} créations</span>
        </Link>
      </div>
    </section>
  );
}
