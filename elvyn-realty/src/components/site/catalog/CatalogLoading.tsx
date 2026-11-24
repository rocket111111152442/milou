import { ListingCardSkeleton } from "../ListingCard";

export function CatalogLoading() {
  return (
    <div className="container py-8 sm:py-12" role="status" aria-live="polite">
      <span className="sr-only">Cargando… / Loading…</span>
      <div className="skeleton h-9 w-2/3 max-w-md rounded-lg" />
      <div className="skeleton mt-3 h-4 w-full max-w-xl rounded" />
      <div className="mt-8 grid gap-8 lg:grid-cols-[300px_1fr]">
        <div className="skeleton hidden h-[520px] rounded-2xl lg:block" />
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => <ListingCardSkeleton key={i} />)}
        </div>
      </div>
    </div>
  );
}
