import type { Metadata } from "next";
import { Checkout } from "@/components/shop/Checkout";
import { PageHero } from "@/components/site/PageHero";
import { getDelivery, getSettings } from "@/lib/catalog";
import { getStripe } from "@/lib/orders";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Commande", robots: { index: false } };

export default async function CheckoutPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const [delivery, settings] = await Promise.all([getDelivery(), getSettings()]);
  return (
    <div className="fern-night bg-noir">
      <PageHero eyebrow="Commande sécurisée" title="Plus que quelques" accent="pétales…" crumbs={[{ href: "/commande", label: "Commande" }]} compact />
      <Checkout
        cancelled={sp.annule === "1"}
        config={{
          deliveryEnabled: delivery.deliveryEnabled,
          pickupEnabled: delivery.pickupEnabled,
          driveEnabled: delivery.driveEnabled,
          pickupNote: delivery.pickupNote,
          driveNote: delivery.driveNote,
          allowPayInStore: settings.allowPayInStore,
          stripeEnabled: !!getStripe(),
          shopAddress: `${settings.address}, ${settings.city}`,
        }}
      />
    </div>
  );
}
