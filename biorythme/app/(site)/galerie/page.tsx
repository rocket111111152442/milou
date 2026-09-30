import type { Metadata } from "next";
import Gallery from "@/components/Gallery";
import { SplitTitle } from "@/components/Reveal";

export const metadata: Metadata = { title: "Galerie" };

export default function GaleriePage() {
  return (
    <section className="mx-auto max-w-7xl px-4 pt-36 sm:px-6">
      <p className="text-xs uppercase tracking-[0.2em] text-volt">Six-Fours-les-Plages & Sanary-sur-Mer</p>
      <h1 className="font-display mt-4 text-7xl sm:text-9xl">
        <SplitTitle lines={["Galerie"]} />
      </h1>
      <p className="mt-4 max-w-lg text-bone/75">
        Découvrez nos salles de sport : les studios, l&apos;équipe, les équipements et les machines de musculation.
      </p>
      <div className="mt-12">
        <Gallery />
      </div>
    </section>
  );
}
