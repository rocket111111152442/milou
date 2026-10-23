import { euro, frDate, MODE_LABEL } from "@/lib/format";
import type { Order } from "@/lib/types";

export function OrderSummary({ order }: { order: Order }) {
  return (
    <div className="rounded-[2rem] border border-ivory/10 bg-ivory/[0.03] p-6 sm:p-8">
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <p className="eyebrow text-gold">{MODE_LABEL[order.mode]}</p>
          <p className="mt-2 font-display text-2xl">{frDate(order.date)}</p>
          <p className="text-sm text-ivory/60">{order.slotLabel}</p>
        </div>
        {order.recipient && (
          <div>
            <p className="eyebrow text-gold">Destinataire</p>
            <p className="mt-2 text-sm leading-relaxed text-ivory/75">
              {order.recipient.name}
              <br />
              {order.recipient.address}
              {order.recipient.address2 && (
                <>
                  <br />
                  {order.recipient.address2}
                </>
              )}
              <br />
              {order.recipient.postcode} {order.recipient.city}
            </p>
          </div>
        )}
      </div>
      <ul className="mt-8 divide-y divide-ivory/10 border-y border-ivory/10">
        {order.items.map((i, k) => (
          <li key={k} className="flex justify-between gap-4 py-4 text-sm">
            <span>
              {i.quantity} × <span className="font-display text-lg">{i.name}</span>
              {i.variantName && <span className="text-ivory/50"> — {i.variantName}</span>}
              {i.addons.length > 0 && <span className="block text-xs text-gold/80">+ {i.addons.map((a) => a.name).join(", ")}</span>}
              {i.custom && <span className="block text-xs text-ivory/50">{i.custom.stems.map((s) => `${s.quantity} ${s.name.toLowerCase()}`).join(", ")}</span>}
            </span>
            <span className="tabular-nums">{euro(i.lineTotal)}</span>
          </li>
        ))}
      </ul>
      <dl className="mt-5 space-y-1.5 text-sm">
        <div className="flex justify-between text-ivory/65">
          <dt>Sous-total</dt>
          <dd>{euro(order.subtotal)}</dd>
        </div>
        {order.mode === "delivery" && (
          <div className="flex justify-between text-ivory/65">
            <dt>Livraison</dt>
            <dd>{order.deliveryFee ? euro(order.deliveryFee) : "Offerte"}</dd>
          </div>
        )}
        {order.discount > 0 && (
          <div className="flex justify-between text-gold-light">
            <dt>Remise {order.promoCode}</dt>
            <dd>− {euro(order.discount)}</dd>
          </div>
        )}
        <div className="flex items-baseline justify-between pt-3">
          <dt className="eyebrow">Total</dt>
          <dd className="font-display text-3xl">{euro(order.total)}</dd>
        </div>
      </dl>
      {order.cardMessage && (
        <blockquote className="mt-6 rounded-xl bg-[#F3EADF] p-5 text-center font-display text-lg italic text-noir">
          « {order.cardMessage} »{order.cardSignature && !order.anonymous && <span className="mt-1 block not-italic text-aubergine-700">— {order.cardSignature}</span>}
        </blockquote>
      )}
    </div>
  );
}
