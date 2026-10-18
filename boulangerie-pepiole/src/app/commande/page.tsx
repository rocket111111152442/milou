import type { Metadata } from "next";
import { ordersEnabled } from "@/lib/order-config";
import { SHOPS } from "@/lib/shops";
import { Checkout } from "@/components/order/Checkout";

export const metadata: Metadata = {
  title: "Ma commande",
  description: "Finalisez votre commande et choisissez votre créneau de retrait au Pétrin de Pépiole.",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

export default function CommandePage() {
  return (
    <section className="grain relative min-h-screen bg-farine px-6 pb-32 pt-32 sm:pt-40">
      <div className="relative z-10 mx-auto max-w-6xl">
        <Checkout enabledShops={SHOPS.filter((s) => ordersEnabled(s.id)).map((s) => s.id)} />
      </div>
    </section>
  );
}
