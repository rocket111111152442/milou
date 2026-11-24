import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { imageUrl } from "@/lib/catalog/manual";
import { Card } from "@/components/admin/ui";
import { ListingForm } from "@/components/admin/ListingForm";
import { PhotoUploader } from "@/components/admin/PhotoUploader";
import { deleteImage, deleteListing, makeCover } from "../actions";
import { formChoices } from "../form-data";

export const metadata = { title: "Editar propiedad" };
export const dynamic = "force-dynamic";

export default async function EditListing({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ creada?: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const db = await getDb();
  const [r] = await db.select().from(schema.manualListings).where(eq(schema.manualListings.id, id));
  if (!r) notFound();
  const images = await db
    .select({ id: schema.manualListingImages.id })
    .from(schema.manualListingImages)
    .where(eq(schema.manualListingImages.listingId, id))
    .orderBy(asc(schema.manualListingImages.position), asc(schema.manualListingImages.id));
  const { categories, cities } = await formChoices();
  const { creada } = await searchParams;
  return (
    <div className="max-w-4xl space-y-6">
      <Link href="/admin/propiedades" className="text-sm text-ink-muted hover:underline">← Propiedades propias</Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-semibold">{r.title}</h1>
        {r.published && r.slug && <Link href={`/propiedad/${r.slug}`} target="_blank" className="btn-outline">Ver en el sitio</Link>}
      </div>
      {creada && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">Propiedad creada (borrador si no marcaste «Publicada»). Añade las fotos y publícala.</p>}
      <Card title={`Fotos (${images.length})`}>
        {images.length > 0 && (
          <ul className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {images.map((img, i) => (
              <li key={img.id} className="overflow-hidden rounded-xl border border-navy-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imageUrl(img.id)} alt={`Foto ${i + 1}`} className="aspect-[4/3] w-full object-cover" loading="lazy" />
                <div className="flex items-center justify-between gap-1 p-2 text-xs">
                  {i === 0 ? (
                    <span className="font-semibold text-brand-dark">Portada</span>
                  ) : (
                    <form action={makeCover}><input type="hidden" name="imageId" value={img.id} /><input type="hidden" name="listingId" value={id} /><button className="hover:underline">Hacer portada</button></form>
                  )}
                  <form action={deleteImage}><input type="hidden" name="imageId" value={img.id} /><input type="hidden" name="listingId" value={id} /><button className="text-red-700 hover:underline">Eliminar</button></form>
                </div>
              </li>
            ))}
          </ul>
        )}
        <PhotoUploader listingId={id} />
      </Card>
      <Card title="Datos">
        <ListingForm
          categories={categories}
          cities={cities}
          initial={{ ...r, amenities: r.amenities ?? [] }}
        />
      </Card>
      <Card title="Eliminar">
        <form action={deleteListing} className="flex flex-wrap items-center gap-3">
          <input type="hidden" name="id" value={id} />
          <p className="text-sm text-ink-muted">Borra la propiedad y sus fotos del sitio. No se puede deshacer.</p>
          <details>
            <summary className="cursor-pointer rounded-xl border border-red-200 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50">Eliminar la propiedad…</summary>
            <button className="mt-2 rounded-xl bg-red-700 px-4 py-2 text-sm font-semibold text-white">Confirmar: eliminar definitivamente</button>
          </details>
        </form>
      </Card>
    </div>
  );
}
