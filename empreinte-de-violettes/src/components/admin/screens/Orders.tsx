"use client";

import { Download, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { euro, frDate, frDateTime, MODE_LABEL, ORDER_STATUS } from "@/lib/format";
import type { Order } from "@/lib/types";
import { Badge, Empty, PageHeader } from "../ui";

const TABS = [
  { id: "todo", label: "À traiter", test: (o: Order) => ["paid", "preparing", "ready", "out_for_delivery"].includes(o.status) },
  { id: "pending", label: "Paiement en attente", test: (o: Order) => o.status === "pending_payment" },
  { id: "done", label: "Terminées", test: (o: Order) => ["delivered", "picked_up"].includes(o.status) },
  { id: "cancelled", label: "Annulées / remboursées", test: (o: Order) => ["cancelled", "refunded"].includes(o.status) },
  { id: "all", label: "Toutes", test: () => true },
];

function csv(orders: Order[]) {
  const head = ["Numéro", "Créée le", "Statut", "Paiement", "Mode", "Date", "Créneau", "Client", "E-mail", "Téléphone", "Destinataire", "Adresse", "CP", "Ville", "Articles", "Sous-total", "Livraison", "Remise", "Total", "Message carte"];
  const rows = orders.map((o) => [
    o.number,
    o.createdAt,
    ORDER_STATUS[o.status]?.label,
    o.paymentStatus,
    MODE_LABEL[o.mode],
    o.date,
    o.slotLabel,
    `${o.customer.firstName} ${o.customer.lastName}`,
    o.customer.email,
    o.customer.phone,
    o.recipient?.name || "",
    [o.recipient?.address, o.recipient?.address2].filter(Boolean).join(" "),
    o.recipient?.postcode || "",
    o.recipient?.city || "",
    o.items.map((i) => `${i.quantity}x ${i.name}${i.variantName ? " (" + i.variantName + ")" : ""}`).join(" | "),
    (o.subtotal / 100).toFixed(2),
    (o.deliveryFee / 100).toFixed(2),
    (o.discount / 100).toFixed(2),
    (o.total / 100).toFixed(2),
    o.cardMessage || "",
  ]);
  return [head, ...rows].map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(";")).join("\n");
}

export function OrdersScreen({ orders }: { orders: Order[] }) {
  const [tab, setTab] = useState("todo");
  const [q, setQ] = useState("");
  const [mode, setMode] = useState("");
  const list = useMemo(() => {
    const t = TABS.find((x) => x.id === tab)!;
    const n = q.trim().toLowerCase();
    return orders
      .filter(t.test)
      .filter((o) => !mode || o.mode === mode)
      .filter((o) => !n || `${o.number} ${o.customer.firstName} ${o.customer.lastName} ${o.customer.email} ${o.customer.phone} ${o.recipient?.name || ""} ${o.recipient?.city || ""}`.toLowerCase().includes(n))
      .sort((a, b) => (tab === "todo" ? (a.date + a.slotId).localeCompare(b.date + b.slotId) : b.createdAt.localeCompare(a.createdAt)));
  }, [orders, tab, q, mode]);

  const download = () => {
    const blob = new Blob(["﻿" + csv(list)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `commandes-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  return (
    <div>
      <PageHeader
        title="Commandes"
        subtitle={`${orders.length} commande(s) au total`}
        actions={
          <button onClick={download} className="adm-btn adm-btn-ghost">
            <Download className="h-4 w-4" /> Export CSV
          </button>
        }
      />
      <div className="mb-4 flex flex-wrap gap-1.5">
        {TABS.map((t) => {
          const n = orders.filter(t.test).length;
          return (
            <button key={t.id} onClick={() => setTab(t.id)} className={cn("rounded-full px-4 py-1.5 text-sm transition", tab === t.id ? "bg-aubergine-700 text-white" : "bg-white text-noir/60 hover:text-noir")}>
              {t.label} <span className="ml-1 opacity-60">{n}</span>
            </button>
          );
        })}
      </div>
      <div className="adm-card overflow-hidden">
        <div className="flex flex-wrap gap-3 border-b border-noir/[0.06] p-4">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-noir/35" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="N°, client, e-mail, ville…" className="adm-input pl-9" />
          </div>
          <select value={mode} onChange={(e) => setMode(e.target.value)} className="adm-input w-auto">
            <option value="">Tous les modes</option>
            <option value="delivery">Livraison</option>
            <option value="pickup">Retrait</option>
            <option value="drive">Drive</option>
          </select>
        </div>
        {list.length === 0 ? (
          <div className="p-6">
            <Empty text="Aucune commande dans cette vue." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-noir/[0.06] text-left text-[0.68rem] uppercase tracking-wider text-noir/45">
                  <th className="px-4 py-3 font-medium">Commande</th>
                  <th className="px-4 py-3 font-medium">Client</th>
                  <th className="px-4 py-3 font-medium">Pour le</th>
                  <th className="px-4 py-3 font-medium">Mode</th>
                  <th className="px-4 py-3 font-medium">Statut</th>
                  <th className="px-4 py-3 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {list.map((o) => (
                  <tr key={o.id} className="border-b border-noir/[0.04] transition hover:bg-aubergine-50/60">
                    <td className="px-4 py-3">
                      <Link href={`/admin/commandes/${o.id}`} className="font-medium text-aubergine-700 hover:underline">
                        {o.number}
                      </Link>
                      <span className="block text-xs text-noir/40">{frDateTime(o.createdAt)}</span>
                    </td>
                    <td className="px-4 py-3">
                      {o.customer.firstName} {o.customer.lastName}
                      <span className="block text-xs text-noir/40">{o.customer.phone}</span>
                    </td>
                    <td className="px-4 py-3">
                      {frDate(o.date)}
                      <span className="block text-xs text-noir/40">{o.slotLabel}</span>
                    </td>
                    <td className="px-4 py-3">
                      {MODE_LABEL[o.mode]}
                      {o.recipient && <span className="block text-xs text-noir/40">{o.recipient.city}</span>}
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={ORDER_STATUS[o.status]?.tone}>{ORDER_STATUS[o.status]?.label}</Badge>
                      {o.paymentStatus === "in_store" && <span className="mt-1 block text-[0.65rem] text-amber-700">À régler au retrait</span>}
                      {o.paymentStatus === "demo" && <span className="mt-1 block text-[0.65rem] text-noir/40">Démo</span>}
                    </td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums">{euro(o.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
