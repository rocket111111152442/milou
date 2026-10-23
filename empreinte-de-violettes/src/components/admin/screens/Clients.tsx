"use client";

import { Download, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { euro, frDate } from "@/lib/format";
import type { Order } from "@/lib/types";
import { Badge, Empty, PageHeader } from "../ui";

type Client = { email: string; name: string; phone: string; orders: number; spent: number; last: string; subscribed: boolean };

export function ClientsScreen({ orders, subscribers }: { orders: Order[]; subscribers: string[] }) {
  const [q, setQ] = useState("");
  const clients = useMemo(() => {
    const map = new Map<string, Client>();
    for (const o of orders) {
      if (o.status === "pending_payment") continue;
      const k = o.customer.email.toLowerCase();
      const c = map.get(k) || { email: k, name: `${o.customer.firstName} ${o.customer.lastName}`, phone: o.customer.phone, orders: 0, spent: 0, last: "", subscribed: subscribers.includes(k) };
      c.orders += 1;
      if (!["cancelled", "refunded"].includes(o.status)) c.spent += o.total;
      if (o.createdAt > c.last) c.last = o.createdAt;
      map.set(k, c);
    }
    return Array.from(map.values()).sort((a, b) => b.spent - a.spent);
  }, [orders, subscribers]);
  const list = clients.filter((c) => !q || `${c.name} ${c.email} ${c.phone}`.toLowerCase().includes(q.toLowerCase()));

  const download = () => {
    const rows = [["Nom", "E-mail", "Téléphone", "Commandes", "Total dépensé", "Dernière commande", "Newsletter"], ...list.map((c) => [c.name, c.email, c.phone, c.orders, (c.spent / 100).toFixed(2), c.last.slice(0, 10), c.subscribed ? "oui" : "non"])];
    const blob = new Blob(["﻿" + rows.map((r) => r.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(";")).join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "clients.csv";
    a.click();
  };

  return (
    <div>
      <PageHeader
        title="Clients"
        subtitle={`${clients.length} client(s) · ${euro(clients.reduce((s, c) => s + c.spent, 0))} cumulés`}
        actions={
          <button onClick={download} className="adm-btn adm-btn-ghost">
            <Download className="h-4 w-4" /> Export CSV
          </button>
        }
      />
      <div className="adm-card overflow-hidden">
        <div className="border-b border-noir/[0.06] p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-noir/35" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nom, e-mail, téléphone…" className="adm-input pl-9" />
          </div>
        </div>
        {list.length === 0 ? (
          <div className="p-6">
            <Empty text="Vos clients apparaîtront ici après leurs premières commandes." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-noir/[0.06] text-left text-[0.68rem] uppercase tracking-wider text-noir/45">
                  <th className="px-4 py-3 font-medium">Client</th>
                  <th className="px-4 py-3 font-medium">Contact</th>
                  <th className="px-4 py-3 font-medium">Commandes</th>
                  <th className="px-4 py-3 font-medium">Dernière</th>
                  <th className="px-4 py-3 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {list.map((c) => (
                  <tr key={c.email} className="border-b border-noir/[0.04]">
                    <td className="px-4 py-3 font-medium">
                      {c.name} {c.orders >= 3 && <Badge className="ml-1 bg-gold/20 text-amber-800">Fidèle</Badge>} {c.subscribed && <Badge className="ml-1 bg-aubergine-100 text-aubergine-700">Newsletter</Badge>}
                    </td>
                    <td className="px-4 py-3 text-noir/60">
                      <a href={`mailto:${c.email}`} className="hover:underline">
                        {c.email}
                      </a>
                      <span className="block text-xs">{c.phone}</span>
                    </td>
                    <td className="px-4 py-3">{c.orders}</td>
                    <td className="px-4 py-3 text-noir/60">{frDate(c.last.slice(0, 10))}</td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums">{euro(c.spent)}</td>
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
