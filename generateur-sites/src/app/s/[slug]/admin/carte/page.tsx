import { notFound } from "next/navigation";
import { getSettingsFresh } from "@/lib/settings-store";
import { getTenantFresh } from "@/lib/tenant-store";
import { CatalogEditor } from "./CatalogEditor";

export const metadata = { title: "Carte & prix" };

export default async function AdminCartePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tenant = await getTenantFresh(slug);
  if (!tenant) notFound();
  const s = await getSettingsFresh(slug, tenant.products);
  return (
    <CatalogEditor
      initial={{ prices: s.prices, unavailable: s.unavailable, hidden: s.hidden, custom: s.custom, edits: s.edits }}
      updatedAt={s.updatedAt ?? null}
    />
  );
}
