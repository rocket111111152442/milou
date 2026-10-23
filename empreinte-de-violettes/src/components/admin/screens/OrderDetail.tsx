"use client";

import { ArrowLeft, Loader2, Mail, MapPin, Phone, Printer, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { euro, frDate, frDateTime, MODE_LABEL, ORDER_STATUS } from "@/lib/format";
import type { DeliverySettings, Order, OrderStatus } from "@/lib/types";
import { api, Badge, Card, confirmAction, TextArea, toast, Toggle } from "../ui";

const FLOW: Record<string, OrderStatus[]> = {
  delivery: ["paid", "preparing", "ready", "out_for_delivery", "delivered"],
  pickup: ["paid", "preparing", "ready", "picked_up"],
  drive: ["paid", "preparing", "ready", "picked_up"],
};

export function OrderDetail({ order: initial, delivery, stripeEnabled }: { order: Order; delivery: DeliverySettings; stripeEnabled: boolean }) {
  const router = useRouter();
  const [order, setOrder] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [notify, setNotify] = useState(true);
  const [notes, setNotes] = useState(order.adminNotes || "");
  const [date, setDate] = useState(order.date);
  const [slotId, setSlotId] = useState(order.slotId);
  const flow = FLOW[order.mode];
  const idx = flow.indexOf(order.status);

  async function setStatus(status: OrderStatus) {
    setBusy(status);
    try {
      const r = await api<{ order: Order }>(`/api/admin/orders/${order.id}/status`, { body: { status, notify } });
      setOrder(r.order);
      toast.ok(`Statut : ${ORDER_STATUS[status].label}`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    }
    setBusy(null);
  }

  async function refund() {
    if (!confirmAction(order.paymentMethod === "stripe" ? `Rembourser ${euro(order.total)} via Stripe ?` : "Marquer cette commande comme remboursée ?")) return;
    setBusy("refund");
    try {
      const r = await api<{ order: Order }>(`/api/admin/orders/${order.id}/refund`, { body: {} });
      setOrder(r.order);
      toast.ok("Remboursement effectué");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    }
    setBusy(null);
  }

  async function saveNotes() {
    setBusy("notes");
    try {
      const slot = delivery.slots.find((s) => s.id === slotId);
      const r = await api<{ order: Order }>(`/api/admin/orders/${order.id}/notes`, { body: { adminNotes: notes, date, slotId, slotLabel: slot?.label } });
      setOrder(r.order);
      toast.ok("Enregistré");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    }
    setBusy(null);
  }

  const mapsUrl = order.recipient ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${order.recipient.address}, ${order.recipient.postcode} ${order.recipient.city}`)}` : "";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link href="/admin/commandes" className="mb-2 inline-flex items-center gap-1 text-sm text-noir/50 hover:text-noir">
            <ArrowLeft className="h-4 w-4" /> Commandes
          </Link>
          <h1 className="font-display text-4xl">Commande {order.number}</h1>
          <p className="text-sm text-noir/50">
            Passée le {frDateTime(order.createdAt)} · <Badge className={ORDER_STATUS[order.status]?.tone}>{ORDER_STATUS[order.status]?.label}</Badge>
          </p>
        </div>
        <div className="flex gap-2">
          <a href={`/admin/imprimer/${order.id}`} target="_blank" className="adm-btn adm-btn-ghost">
            <Printer className="h-4 w-4" /> Bon & carte
          </a>
          {order.status !== "refunded" && order.status !== "pending_payment" && (
            <button onClick={refund} disabled={!!busy} className="adm-btn adm-btn-danger">
              {busy === "refund" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />} Rembourser
            </button>
          )}
        </div>
      </div>

      <Card title="Avancement">
        <div className="flex flex-wrap gap-2">
          {flow.map((s, i) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              disabled={!!busy || s === order.status}
              className={cn(
                "flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm transition",
                s === order.status ? "border-aubergine-600 bg-aubergine-600 text-white" : i < idx ? "border-aubergine-200 bg-aubergine-50 text-aubergine-700" : "border-noir/10 bg-white hover:border-aubergine-400",
              )}
            >
              {busy === s && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span className="text-xs opacity-60">{i + 1}</span> {ORDER_STATUS[s].label}
            </button>
          ))}
          <button onClick={() => confirmAction("Annuler cette commande ?") && setStatus("cancelled")} disabled={!!busy || order.status === "cancelled"} className="rounded-xl border border-noir/10 px-4 py-2.5 text-sm text-noir/50 hover:border-red-300 hover:text-red-600">
            Annuler
          </button>
        </div>
        <div className="mt-4 max-w-md">
          <Toggle label="Prévenir le client par e-mail" help="Prête, en livraison, livrée, annulée" checked={notify} onChange={setNotify} />
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card title="Articles">
          <ul className="divide-y divide-noir/[0.06]">
            {order.items.map((i, k) => (
              <li key={k} className="flex gap-4 py-3">
                <div className="h-16 w-14 shrink-0 overflow-hidden rounded-lg bg-aubergine-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {i.image && <img src={i.image.startsWith("https://images.unsplash.com") ? `${i.image.split("?")[0]}?w=160&q=60` : i.image} alt="" className="h-full w-full object-cover" />}
                </div>
                <div className="flex-1 text-sm">
                  <p className="font-medium">
                    {i.quantity} × {i.name} {i.variantName && <span className="font-normal text-noir/50">— {i.variantName}</span>}
                  </p>
                  {i.addons.length > 0 && <p className="text-xs text-aubergine-600">+ {i.addons.map((a) => `${a.name} (${euro(a.price)})`).join(", ")}</p>}
                  {i.custom && (
                    <p className="mt-1 text-xs text-noir/60">
                      {i.custom.stems.map((s) => `${s.quantity} ${s.name}`).join(", ")} · {i.custom.wrappingName}
                      {i.custom.note && <span className="block italic">« {i.custom.note} »</span>}
                    </p>
                  )}
                </div>
                <p className="text-sm tabular-nums">{euro(i.lineTotal)}</p>
              </li>
            ))}
          </ul>
          <dl className="mt-4 space-y-1 border-t border-noir/[0.06] pt-4 text-sm">
            <div className="flex justify-between text-noir/60">
              <dt>Sous-total</dt>
              <dd>{euro(order.subtotal)}</dd>
            </div>
            {order.mode === "delivery" && (
              <div className="flex justify-between text-noir/60">
                <dt>Livraison ({order.zoneName})</dt>
                <dd>{euro(order.deliveryFee)}</dd>
              </div>
            )}
            {order.discount > 0 && (
              <div className="flex justify-between text-aubergine-700">
                <dt>Remise {order.promoCode}</dt>
                <dd>− {euro(order.discount)}</dd>
              </div>
            )}
            <div className="flex justify-between pt-2 text-base font-semibold">
              <dt>Total</dt>
              <dd>{euro(order.total)}</dd>
            </div>
            <div className="flex justify-between pt-1 text-xs text-noir/45">
              <dt>Paiement</dt>
              <dd>
                {order.paymentMethod === "stripe" ? "Stripe" : order.paymentMethod === "in_store" ? "En boutique" : "Démo"} · {order.paymentStatus}
                {order.stripePaymentIntentId && stripeEnabled && (
                  <a className="ml-2 text-aubergine-600 underline" href={`https://dashboard.stripe.com/payments/${order.stripePaymentIntentId}`} target="_blank" rel="noreferrer">
                    voir sur Stripe
                  </a>
                )}
              </dd>
            </div>
          </dl>
        </Card>

        <div className="space-y-6">
          <Card title={MODE_LABEL[order.mode]}>
            <p className="font-display text-2xl">{frDate(order.date)}</p>
            <p className="text-sm text-noir/55">{order.slotLabel}</p>
            {order.recipient && (
              <div className="mt-4 space-y-1 text-sm">
                <p className="font-medium">{order.recipient.name}</p>
                {order.recipient.company && <p>{order.recipient.company}</p>}
                <p>{order.recipient.address}</p>
                {order.recipient.address2 && <p>{order.recipient.address2}</p>}
                <p>
                  {order.recipient.postcode} {order.recipient.city}
                </p>
                <p className="flex items-center gap-2 text-noir/60">
                  <Phone className="h-3.5 w-3.5" /> <a href={`tel:${order.recipient.phone}`}>{order.recipient.phone}</a>
                </p>
                {order.recipient.instructions && <p className="rounded-lg bg-amber-50 p-2 text-amber-900">{order.recipient.instructions}</p>}
                <a href={mapsUrl} target="_blank" rel="noreferrer" className="adm-btn adm-btn-ghost mt-2">
                  <MapPin className="h-4 w-4" /> Itinéraire
                </a>
              </div>
            )}
            <div className="mt-5 grid grid-cols-2 gap-2 border-t border-noir/[0.06] pt-4">
              <label className="block">
                <span className="adm-label">Reporter au</span>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="adm-input" />
              </label>
              <label className="block">
                <span className="adm-label">Créneau</span>
                <select value={slotId} onChange={(e) => setSlotId(e.target.value)} className="adm-input">
                  {delivery.slots.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </Card>

          <Card title="Client">
            <p className="font-medium">
              {order.customer.firstName} {order.customer.lastName}
            </p>
            <p className="mt-1 flex items-center gap-2 text-sm text-noir/60">
              <Mail className="h-3.5 w-3.5" /> <a href={`mailto:${order.customer.email}`}>{order.customer.email}</a>
            </p>
            <p className="mt-1 flex items-center gap-2 text-sm text-noir/60">
              <Phone className="h-3.5 w-3.5" /> <a href={`tel:${order.customer.phone}`}>{order.customer.phone}</a>
            </p>
          </Card>

          {order.cardMessage && (
            <Card title="Carte message">
              <blockquote className="rounded-xl bg-[#F3EADF] p-4 text-center font-display text-lg italic">
                « {order.cardMessage} »{order.anonymous ? <span className="mt-1 block text-xs not-italic text-noir/45">(anonyme)</span> : order.cardSignature && <span className="mt-1 block not-italic text-aubergine-700">— {order.cardSignature}</span>}
              </blockquote>
            </Card>
          )}

          <Card title="Notes internes">
            <TextArea label="Visible uniquement par l'équipe" value={notes} onChange={setNotes} rows={3} />
            <button onClick={saveNotes} disabled={busy === "notes"} className="adm-btn adm-btn-primary mt-3">
              {busy === "notes" && <Loader2 className="h-4 w-4 animate-spin" />} Enregistrer notes & créneau
            </button>
          </Card>

          <Card title="Historique">
            <ol className="space-y-3 border-l border-noir/10 pl-4 text-sm">
              {[...order.history].reverse().map((h, i) => (
                <li key={i} className="relative">
                  <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-aubergine-500" />
                  <p>{h.label}</p>
                  <p className="text-xs text-noir/40">{frDateTime(h.at)}</p>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>
    </div>
  );
}
