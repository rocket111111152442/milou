import Image from "next/image";
import type { Product } from "@/lib/catalog";
import { Monogram } from "@/components/ui/Logo";

/** Photo du produit, ou une vignette illustrée si aucune photo n'est fournie. */
export function ProductThumb({
  product,
  className = "",
  sizes = "(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw",
  imgClassName = "",
}: {
  product: Product;
  className?: string;
  sizes?: string;
  imgClassName?: string;
}) {
  return (
    <div className={`relative overflow-hidden bg-mie ${className}`}>
      {product.image ? (
        <Image src={product.image} alt={product.name} fill sizes={sizes} className={`object-cover ${imgClassName}`} />
      ) : (
        <div className="absolute inset-0 grid place-items-center bg-[radial-gradient(circle_at_30%_20%,var(--color-dore),var(--color-croute)_70%)] text-creme">
          <WheatPattern />
          <div className="relative flex flex-col items-center gap-2 p-3 text-center">
            <Monogram className="h-1/3 max-h-16 min-h-8 w-auto opacity-90" />
            <span className="hidden font-display text-lg leading-tight sm:block">{product.name}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function WheatPattern() {
  return (
    <svg className="absolute inset-0 h-full w-full opacity-15" aria-hidden="true">
      <defs>
        <pattern id="wheat" width="36" height="36" patternUnits="userSpaceOnUse" patternTransform="rotate(30)">
          <path d="M18 4v28M18 10c-4 0-6-3-6-6 4 0 6 3 6 6Zm0 0c4 0 6-3 6-6-4 0-6 3-6 6Zm0 8c-4 0-6-3-6-6 4 0 6 3 6 6Zm0 0c4 0 6-3 6-6-4 0-6 3-6 6Z" fill="none" stroke="currentColor" strokeWidth="1.2" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#wheat)" />
    </svg>
  );
}
