import { notFound } from "next/navigation";
import { PrintButton } from "@/components/admin/PrintButton";
import { VioletMark } from "@/components/site/Logo";
import { get, getDoc } from "@/lib/db";
import { euro, frDate, MODE_LABEL } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function PrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [order, settings] = await Promise.all([get("orders", id), getDoc("settings")]);
  if (!order) notFound();
  return (
    <div className="min-h-screen bg-white p-8 text-black print:p-0">
      <div className="no-print mb-6 flex justify-between">
        <a href={`/admin/commandes/${order.id}`} className="text-sm underline">
          ← Retour
        </a>
        <PrintButton />
      </div>
      <section className="mx-auto max-w-[190mm] border border-black/20 p-8">
        <div className="flex items-start justify-between border-b border-black/20 pb-4">
          <div>
            <p className="font-caps text-xs uppercase tracking-[0.3em]">Bon de préparation</p>
            <h1 className="mt-1 font-display text-4xl">{order.number}</h1>
          </div>
          <div className="text-right text-sm">
            <p className="font-caps uppercase tracking-[0.15em]">{settings.shopName}</p>
            <p>{settings.phone}</p>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-6 text-sm">
          <div>
            <p className="text-xs uppercase tracking-wider text-black/50">{MODE_LABEL[order.mode]}</p>
            <p className="mt-1 text-2xl font-semibold">{frDate(order.date, true)}</p>
            <p>{order.slotLabel}</p>
          </div>
          <div>
            {order.recipient ? (
              <>
                <p className="text-xs uppercase tracking-wider text-black/50">Destinataire</p>
                <p className="mt-1 font-semibold">{order.recipient.name}</p>
                {order.recipient.company && <p>{order.recipient.company}</p>}
                <p>{order.recipient.address}</p>
                {order.recipient.address2 && <p>{order.recipient.address2}</p>}
                <p>
                  {order.recipient.postcode} {order.recipient.city}
                </p>
                <p>Tél. {order.recipient.phone}</p>
                {order.recipient.instructions && <p className="mt-1 border border-black/30 p-1">⚠ {order.recipient.instructions}</p>}
              </>
            ) : (
              <>
                <p className="text-xs uppercase tracking-wider text-black/50">Client</p>
                <p className="mt-1 font-semibold">
                  {order.customer.firstName} {order.customer.lastName}
                </p>
                <p>{order.customer.phone}</p>
                {order.paymentStatus === "in_store" && <p className="mt-1 font-semibold">À ENCAISSER : {euro(order.total)}</p>}
              </>
            )}
          </div>
        </div>
        <table className="mt-6 w-full text-sm">
          <thead>
            <tr className="border-b border-black/30 text-left text-xs uppercase tracking-wider text-black/50">
              <th className="py-2">Qté</th>
              <th className="py-2">Création</th>
              <th className="py-2">Détails</th>
              <th className="py-2 text-center">✓</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((i, k) => (
              <tr key={k} className="border-b border-black/10 align-top">
                <td className="py-3 text-lg font-semibold">{i.quantity}</td>
                <td className="py-3">
                  <p className="font-semibold">{i.name}</p>
                  <p className="text-black/60">{i.variantName}</p>
                </td>
                <td className="py-3 text-black/70">
                  {i.addons.map((a) => a.name).join(", ")}
                  {i.custom && (
                    <>
                      {i.custom.stems.map((s) => `${s.quantity} ${s.name}`).join(", ")} — {i.custom.wrappingName}
                      {i.custom.note && <span className="block italic">« {i.custom.note} »</span>}
                    </>
                  )}
                </td>
                <td className="py-3 text-center">☐</td>
              </tr>
            ))}
          </tbody>
        </table>
        {order.adminNotes && <p className="mt-4 border border-black/30 p-2 text-sm">Note : {order.adminNotes}</p>}
        <p className="mt-4 text-right text-sm">
          Total : <strong>{euro(order.total)}</strong>
        </p>
      </section>

      {order.cardMessage && (
        <section className="mx-auto mt-10 flex h-[100mm] w-[150mm] flex-col items-center justify-center border border-dashed border-black/40 p-10 text-center" style={{ breakInside: "avoid" }}>
          <VioletMark className="h-10 w-10 text-[#6E4F8C]" />
          <p className="mt-5 whitespace-pre-wrap font-display text-2xl italic leading-snug">{order.cardMessage}</p>
          {!order.anonymous && order.cardSignature && <p className="mt-4 font-display text-xl">— {order.cardSignature}</p>}
          <p className="mt-auto font-caps text-[0.55rem] uppercase tracking-[0.4em] text-black/50">Empreinte de Violettes</p>
        </section>
      )}
    </div>
  );
}
