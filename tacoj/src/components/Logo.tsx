import Image from "next/image";
import { brand } from "@/data/site";

/**
 * LOGO PLACEHOLDER — set `brand.logo` in src/data/site.ts (e.g. "/images/logo.svg")
 * to swap this typographic wordmark for Taco J's official logo.
 */
export default function Logo({ size = "md" }: { size?: "md" | "lg" }) {
  if (brand.logo) {
    return <Image src={brand.logo} alt={brand.name} width={size === "lg" ? 180 : 120} height={size === "lg" ? 72 : 44} className="h-auto w-auto" priority />;
  }
  const big = size === "lg";
  return (
    <span className="group inline-flex items-center gap-2" aria-hidden={false}>
      <span
        className={`relative inline-flex items-center justify-center rounded-full bg-chili font-display text-white shadow-[3px_3px_0_0_#FFC233] transition-transform duration-300 group-hover:-rotate-12 ${
          big ? "h-14 w-14 text-3xl" : "h-10 w-10 text-xl"
        }`}
      >
        J
      </span>
      <span className={`leading-none ${big ? "" : "hidden min-[375px]:inline"}`}>
        <span className={`display block text-cream ${big ? "text-4xl" : "text-[26px]"}`}>
          Taco<span className="text-mango">J</span>
        </span>
        <span className={`block font-sans font-bold uppercase tracking-[0.28em] text-cream/60 ${big ? "text-xs" : "text-[9px]"}`}>
          Taco Joint PH
        </span>
      </span>
    </span>
  );
}
