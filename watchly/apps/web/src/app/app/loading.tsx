import { LoadingBlock, Skeleton } from "@watchly/ui";

export default function Loading() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true">
      <Skeleton className="h-8 w-64" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <div className="rounded-xl border border-line bg-white p-6">
        <LoadingBlock lines={5} />
      </div>
    </div>
  );
}
