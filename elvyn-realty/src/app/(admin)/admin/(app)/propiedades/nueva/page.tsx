import Link from "next/link";
import { Card } from "@/components/admin/ui";
import { ListingForm } from "@/components/admin/ListingForm";
import { formChoices } from "../form-data";

export const metadata = { title: "Nueva propiedad" };
export const dynamic = "force-dynamic";

export default async function NewListing() {
  const { categories, cities } = await formChoices();
  return (
    <div className="max-w-4xl space-y-6">
      <Link href="/admin/propiedades" className="text-sm text-ink-muted hover:underline">← Propiedades propias</Link>
      <h1 className="font-display text-3xl font-semibold">Nueva propiedad</h1>
      <Card title="Datos">
        <ListingForm
          categories={categories}
          cities={cities}
          initial={{ title: "", operation: "sale", categoryId: null, province: null, city: null, sector: null, price: null, currency: "USD", bedrooms: null, bathrooms: null, parking: null, area: null, landArea: null, condition: null, furnished: null, description: "", amenities: [], videoUrl: null, published: false, featured: false }}
        />
      </Card>
    </div>
  );
}
