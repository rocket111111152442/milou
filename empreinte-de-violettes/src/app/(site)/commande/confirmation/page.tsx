import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ConfirmationHero } from "@/components/shop/ConfirmationClient";
import { ConfirmationFallback } from "@/components/shop/ConfirmationFallback";
import { OrderSummary } from "@/components/shop/OrderSummary";
import { list } from "@/lib/db";
import { confirmOrder, getStripe, siteUrl } from "@/lib/orders";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Merci !", robots: { index: false } };

export default async function ConfirmationPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  if (!sp.n || !sp.t) notFound();
  let order = (await list("orders")).find((o) => o.number === sp.n && o.accessToken === sp.t);
  if (!order) return <ConfirmationFallback number={sp.n} token={sp.t} />;

  // filet de sécurité si le webhook n'est pas (encore) arrivé
  const stripe = getStripe();
  if (order.status === "pending_payment" && stripe && order.stripeSessionId) {
    try {
      const s = await stripe.checkout.sessions.retrieve(order.stripeSessionId);
      if (s.payment_status === "paid") {
        order =
          (await confirmOrder(order.id, {
            paymentStatus: "paid",
            paymentIntentId: typeof s.payment_intent === "string" ? s.payment_intent : s.payment_intent?.id,
            base: siteUrl(),
          })) || order;
      }
    } catch (e) {
      console.error("[confirmation] Stripe", e);
    }
  }
  const pending = order.status === "pending_payment";
  const paid = order.paymentStatus === "in_store" ? " — règlement au retrait" : order.paymentStatus === "demo" ? " (mode démonstration, aucun paiement)" : "";

  return (
    <div className="fern-night bg-noir pb-32">
      {pending && <meta httpEquiv="refresh" content="4" />}
      <ConfirmationHero name={order.customer.firstName} number={order.number} paid={paid} pending={pending} />
      <div className="mx-auto max-w-3xl px-6">
        <OrderSummary order={order} />
        <div className="mt-10 flex flex-wrap justify-center gap-4">
          <Link href={`/suivi?n=${encodeURIComponent(order.number)}&t=${order.accessToken}`} className="btn btn-gold">
            <span>Suivre ma commande</span>
          </Link>
          <Link href="/boutique" className="btn btn-ghost text-ivory">
            <span>Retour à la boutique</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
