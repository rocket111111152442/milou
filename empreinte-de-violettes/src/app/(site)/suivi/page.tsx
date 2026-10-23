import type { Metadata } from "next";
import { OrderSummary } from "@/components/shop/OrderSummary";
import { Timeline } from "@/components/shop/Timeline";
import { TrackForm } from "@/components/shop/TrackForm";
import { PageHero } from "@/components/site/PageHero";
import { list } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Suivre ma commande", robots: { index: false } };

export default async function TrackPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const order = sp.n && sp.t ? (await list("orders")).find((o) => o.number === sp.n && o.accessToken === sp.t) : null;
  return (
    <div className="fern-night bg-noir pb-32">
      <PageHero
        eyebrow="Suivi de commande"
        title={order ? `Commande ${order.number}` : "Où en sont"}
        accent={order ? undefined : "mes fleurs ?"}
        crumbs={[{ href: "/suivi", label: "Suivi" }]}
        compact
      />
      <div className="mx-auto max-w-3xl px-6">
        {order ? (
          <div className="space-y-10">
            <div className="rounded-[2rem] border border-gold/20 bg-aubergine-950/60 p-6 sm:p-10">
              <Timeline order={order} />
            </div>
            <OrderSummary order={order} />
          </div>
        ) : (
          <>
            {sp.n && <p className="text-center text-rose-300">Lien de suivi invalide ou expiré.</p>}
            <TrackForm />
          </>
        )}
      </div>
    </div>
  );
}
