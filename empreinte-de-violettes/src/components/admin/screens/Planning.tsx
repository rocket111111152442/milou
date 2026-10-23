"use client";

import { ChevronLeft, ChevronRight, Navigation } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { DAYS, euro, MODE_LABEL, MONTHS, ORDER_STATUS } from "@/lib/format";
import type { DeliverySettings, Order } from "@/lib/types";
import { Badge, PageHeader } from "../ui";

function addDays(iso: string, n: number) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}
function weekStart(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return addDays(iso, -((wd + 6) % 7));
}

export function PlanningScreen({ orders, delivery, today, shopAddress }: { orders: Order[]; delivery: DeliverySettings; today: string; shopAddress: string }) {
  const [start, setStart] = useState(weekStart(today));
  const [mode, setMode] = useState<"" | "delivery" | "pickup">("");
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const active = useMemo(() => orders.filter((o) => !["cancelled", "refunded", "pending_payment"].includes(o.status)), [orders]);

  const route = (date: string) => {
    const stops = active.filter((o) => o.date === date && o.mode === "delivery" && o.recipient && o.status !== "delivered").map((o) => `${o.recipient!.address}, ${o.recipient!.postcode} ${o.recipient!.city}`);
    if (!stops.length) return null;
    const dest = stops[stops.length - 1];
    const way = stops.slice(0, -1).slice(0, 9).join("|");
    return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(shopAddress)}&destination=${encodeURIComponent(dest)}${way ? `&waypoints=${encodeURIComponent(way)}` : ""}&travelmode=driving`;
  };

  const [y, m] = start.split("-").map(Number);
  return (
    <div>
      <PageHeader
        title="Planning"
        subtitle={`Semaine du ${Number(start.slice(8))} ${MONTHS[m - 1]} ${y}`}
        actions={
          <>
            <select value={mode} onChange={(e) => setMode(e.target.value as typeof mode)} className="adm-input w-auto">
              <option value="">Livraisons & retraits</option>
              <option value="delivery">Livraisons</option>
              <option value="pickup">Retraits & Drive</option>
            </select>
            <button onClick={() => setStart(addDays(start, -7))} className="adm-btn adm-btn-ghost" aria-label="Semaine précédente">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button onClick={() => setStart(weekStart(today))} className="adm-btn adm-btn-ghost">
              Aujourd&apos;hui
            </button>
            <button onClick={() => setStart(addDays(start, 7))} className="adm-btn adm-btn-ghost" aria-label="Semaine suivante">
              <ChevronRight className="h-4 w-4" />
            </button>
          </>
        }
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-7">
        {days.map((d) => {
          const wd = new Date(d + "T12:00:00Z").getUTCDay();
          const closed = delivery.closedDays.includes(wd) || delivery.blackoutDates.includes(d);
          const dayOrders = active.filter((o) => o.date === d && (!mode || (mode === "delivery" ? o.mode === "delivery" : o.mode !== "delivery")));
          const r = route(d);
          return (
            <div key={d} className={cn("adm-card flex min-h-[220px] flex-col p-3", d === today && "ring-2 ring-aubergine-500", closed && "opacity-60")}>
              <div className="mb-3 flex items-baseline justify-between px-1">
                <p className="text-sm font-semibold">
                  {DAYS[wd].slice(0, 3)}. <span className="font-display text-2xl">{Number(d.slice(8))}</span>
                </p>
                <span className="text-xs text-noir/40">{closed ? "fermé" : `${dayOrders.length} cmd`}</span>
              </div>
              <div className="flex-1 space-y-3">
                {delivery.slots.map((s) => {
                  const os = dayOrders.filter((o) => o.slotId === s.id);
                  if (!os.length) return null;
                  return (
                    <div key={s.id}>
                      <p className="mb-1 px-1 text-[0.62rem] font-semibold uppercase tracking-wider text-noir/40">{s.label}</p>
                      <div className="space-y-1.5">
                        {os.map((o) => (
                          <Link key={o.id} href={`/admin/commandes/${o.id}`} className={cn("block rounded-lg border-l-4 bg-noir/[0.025] p-2 text-xs transition hover:bg-aubergine-50", o.mode === "delivery" ? "border-aubergine-500" : "border-gold")}>
                            <p className="truncate font-medium">{o.recipient?.name || `${o.customer.firstName} ${o.customer.lastName}`}</p>
                            <p className="truncate text-noir/50">
                              {MODE_LABEL[o.mode]}
                              {o.recipient && ` · ${o.recipient.city}`}
                            </p>
                            <div className="mt-1 flex items-center justify-between">
                              <Badge className={cn("!px-1.5 !text-[0.6rem]", ORDER_STATUS[o.status]?.tone)}>{ORDER_STATUS[o.status]?.label}</Badge>
                              <span className="text-noir/50">{euro(o.total, { compact: true })}</span>
                            </div>
                          </Link>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
              {r && (
                <a href={r} target="_blank" rel="noreferrer" className="adm-btn adm-btn-ghost mt-3 w-full !text-xs">
                  <Navigation className="h-3.5 w-3.5" /> Tournée
                </a>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
