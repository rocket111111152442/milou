import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ordersEnabled } from "@/lib/order-config";
import { getSettings } from "@/lib/settings-store";
import { getTenant } from "@/lib/tenant-store";
import { Checkout } from "@/components/order/Checkout";

export const metadata: Metadata = {
  title: "Ma commande",
  description: "Finalisez votre commande et choisissez votre créneau de retrait.",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

export default async function CommandePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tenant = await getTenant(slug);
  if (!tenant) notFound();
  const settings = await getSettings(slug, tenant.products);
  return (
    <section className="grain relative min-h-screen bg-farine px-6 pb-32 pt-32 sm:pt-40">
      <div className="relative z-10 mx-auto max-w-6xl">
        <Checkout enabledShops={tenant.shops.filter((s) => ordersEnabled(tenant, s, settings)).map((s) => s.id)} />
      </div>
    </section>
  );
}
