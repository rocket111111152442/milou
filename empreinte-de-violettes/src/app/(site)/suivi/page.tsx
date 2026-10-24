import type { Metadata } from "next";
import { PageHead } from "@/components/herbier/PageHead";
import { OrderSummary } from "@/components/shop/OrderSummary";
import { Timeline } from "@/components/shop/Timeline";
import { TrackForm } from "@/components/shop/TrackForm";
import { list } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Suivre ma commande", robots: { index: false } };

export default async function TrackPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const order = sp.n && sp.t ? (await list("orders")).find((o) => o.number === sp.n && o.accessToken === sp.t) : null;
  return (
    <div className="pb-28">
      <PageHead kicker="Suivi de commande" folio={order ? order.number : undefined} title={order ? "Où en sont" : "Où en sont"} accent="vos fleurs ?" plate="pensee" />
      <div className="wrap">
        {order ? (
          <div className="grid gap-14 lg:grid-cols-[1fr_1.2fr] lg:gap-16">
            <div>
              <p className="sc mb-6 text-ink-muted">Registre</p>
              <Timeline order={order} />
            </div>
            <OrderSummary order={order} />
          </div>
        ) : (
          <>
            {sp.n && <p className="mb-8 text-center font-text italic text-[#7d2d2d]">Lien de suivi invalide ou expiré.</p>}
            <TrackForm />
          </>
        )}
      </div>
    </div>
  );
}
