import { notFound } from "next/navigation";
import { inputFromTenant } from "@/lib/tenant-input";
import { publicTenant } from "@/lib/tenant";
import { getTenantFresh } from "@/lib/tenant-store";
import { SiteForm } from "../SiteForm";

export const metadata = { title: "Modifier le site" };

export default async function EditSitePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tenant = await getTenantFresh(slug);
  if (!tenant) notFound();
  return <SiteForm initial={inputFromTenant(publicTenant(tenant))} editSlug={slug} />;
}
