import { euro, frDate, MODE_LABEL } from "@/lib/format";
import type { Order } from "@/lib/types";

/** Récapitulatif d'une commande, présenté comme un bon. */
export function OrderSummary({ order }: { order: Order }) {
  return (
    <div className="sheet perf-top px-6 pb-8 pt-10 sm:px-10">
      <div className="grid gap-8 sm:grid-cols-2">
        <div>
          <p className="sc text-ink-muted">{MODE_LABEL[order.mode]}</p>
          <p className="mt-2 font-display text-[1.6rem] leading-tight">{frDate(order.date).charAt(0).toUpperCase() + frDate(order.date).slice(1)}</p>
          <p className="font-text text-[1rem] italic text-ink-soft">{order.slotLabel}</p>
        </div>
        {order.recipient && (
          <div>
            <p className="sc text-ink-muted">Destinataire</p>
            <p className="mt-2 font-text text-[1rem] leading-relaxed text-ink-soft">
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
      <ul className="mt-8 border-t border-ink/15 font-text">
        {order.items.map((i, k) => (
          <li key={k} className="border-b border-ink/10 py-4">
            <div className="flex items-baseline">
              <span>
                <span className="tab text-ink-muted">{i.quantity} × </span>
                <span className="font-display text-[1.2rem]">{i.name}</span>
                {i.variantName && <span className="italic text-ink-muted"> — {i.variantName}</span>}
              </span>
              <span className="leader" />
              <span className="tab">{euro(i.lineTotal)}</span>
            </div>
            {i.addons.length > 0 && <p className="text-[0.9rem] italic text-plum">+ {i.addons.map((a) => a.name).join(", ")}</p>}
            {i.custom && <p className="text-[0.9rem] italic text-ink-muted">{i.custom.stems.map((s) => `${s.quantity} ${s.name.toLowerCase()}`).join(", ")}</p>}
          </li>
        ))}
      </ul>
      <dl className="mt-5 space-y-1.5 font-text text-[1rem]">
        <div className="flex items-baseline text-ink-soft">
          <dt>Sous-total</dt>
          <span className="leader" />
          <dd className="tab">{euro(order.subtotal)}</dd>
        </div>
        {order.mode === "delivery" && (
          <div className="flex items-baseline text-ink-soft">
            <dt>Livraison</dt>
            <span className="leader" />
            <dd className="tab">{order.deliveryFee ? euro(order.deliveryFee) : "offerte"}</dd>
          </div>
        )}
        {order.discount > 0 && (
          <div className="flex items-baseline text-plum">
            <dt>Remise {order.promoCode}</dt>
            <span className="leader" />
            <dd className="tab">− {euro(order.discount)}</dd>
          </div>
        )}
        <div className="flex items-baseline pt-3">
          <dt className="sc">Total</dt>
          <span className="leader" />
          <dd className="tab font-text text-[1.9rem] leading-none">{euro(order.total)}</dd>
        </div>
      </dl>
      {order.cardMessage && (
        <blockquote className="mx-auto mt-10 max-w-md -rotate-1 border border-ink/15 bg-paper p-6 text-center">
          <p className="font-display text-[1.3rem] italic leading-snug">« {order.cardMessage} »</p>
          {order.cardSignature && !order.anonymous && <p className="mt-2 font-text italic text-ink-soft">— {order.cardSignature}</p>}
        </blockquote>
      )}
    </div>
  );
}
