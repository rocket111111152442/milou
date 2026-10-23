"use client";

import { motion } from "framer-motion";
import { AlertTriangle, ArrowRight, Inbox, Package, ShoppingBag, TrendingUp, Truck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Counter } from "@/components/motion/Counter";
import { cn } from "@/lib/cn";
import { euro, frDate, frDateTime, MODE_LABEL, ORDER_STATUS } from "@/lib/format";
import type { DashboardStats } from "@/lib/stats";
import { Badge, Card, Empty } from "../ui";

function Kpi({ label, value, sub, icon: Icon, i, trend }: { label: string; value: string; sub?: string; icon: typeof Package; i: number; trend?: number | null }) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07, duration: 0.6, ease: [0.22, 1, 0.36, 1] }} className="adm-card relative overflow-hidden p-5">
      <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-aubergine-100/70" />
      <Icon className="relative h-5 w-5 text-aubergine-600" strokeWidth={1.6} />
      <p className="relative mt-4 text-xs uppercase tracking-wider text-noir/50">{label}</p>
      <p className="relative mt-1 font-display text-4xl text-noir">
        <Counter value={value} duration={1.4} />
      </p>
      {(sub || trend != null) && (
        <p className="relative mt-1 flex items-center gap-2 text-xs text-noir/45">
          {trend != null && <span className={cn("font-medium", trend >= 0 ? "text-emerald-600" : "text-red-600")}>{trend >= 0 ? "▲" : "▼"} {Math.abs(trend)} %</span>}
          {sub}
        </p>
      )}
    </motion.div>
  );
}

function RevenueChart({ series }: { series: DashboardStats["series"] }) {
  const max = Math.max(1, ...series.map((s) => s.revenue));
  const [hover, setHover] = useState<number | null>(null);
  const h = series[hover ?? series.length - 1];
  return (
    <div>
      <div className="mb-4 flex items-baseline justify-between">
        <p className="text-sm text-noir/55">
          {hover != null ? frDate(h.date) : "Aujourd'hui"} · <strong className="text-noir">{euro(h.revenue)}</strong> · {h.orders} commande{h.orders > 1 ? "s" : ""}
        </p>
        <p className="text-xs text-noir/40">30 derniers jours</p>
      </div>
      <div className="flex h-48 items-end gap-1" onPointerLeave={() => setHover(null)}>
        {series.map((s, i) => (
          <div key={s.date} className="group relative flex h-full flex-1 items-end" onPointerEnter={() => setHover(i)}>
            <motion.div
              className={cn("w-full rounded-t-md", hover === i ? "bg-gold" : "bg-gradient-to-t from-aubergine-700 to-aubergine-400")}
              initial={{ height: 0 }}
              animate={{ height: `${Math.max(2, (s.revenue / max) * 100)}%` }}
              transition={{ delay: i * 0.015, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[0.65rem] text-noir/40">
        <span>{frDate(series[0].date)}</span>
        <span>{frDate(series[series.length - 1].date)}</span>
      </div>
    </div>
  );
}

function OrderRow({ o }: { o: DashboardStats["recent"][number] }) {
  return (
    <Link href={`/admin/commandes/${o.id}`} className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition hover:bg-aubergine-50">
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">
          {o.customer.firstName} {o.customer.lastName} <span className="font-normal text-noir/40">· {o.number}</span>
        </span>
        <span className="block truncate text-xs text-noir/45">
          {MODE_LABEL[o.mode]} · {frDate(o.date)} · {o.slotLabel}
        </span>
      </span>
      <Badge className={ORDER_STATUS[o.status]?.tone}>{ORDER_STATUS[o.status]?.label}</Badge>
      <span className="w-20 text-right text-sm tabular-nums">{euro(o.total)}</span>
    </Link>
  );
}

export function Dashboard({ s, storage }: { s: DashboardStats; storage: string }) {
  const trend = s.revenuePrev30 ? Math.round(((s.revenue30 - s.revenuePrev30) / s.revenuePrev30) * 100) : null;
  const totalModes = Object.values(s.modes).reduce((a, b) => a + b, 0) || 1;
  const hour = new Date().getHours();
  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm text-noir/50">{frDate(s.today, true)}</p>
          <h1 className="font-display text-4xl text-noir sm:text-5xl">{hour < 12 ? "Belle matinée" : hour < 18 ? "Bel après-midi" : "Belle soirée"} à l&apos;atelier ✦</h1>
        </div>
        <p className="text-xs text-noir/40">Stockage : {storage}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi i={0} icon={TrendingUp} label="Chiffre d'affaires 30 j" value={euro(s.revenue30)} trend={trend} sub="vs 30 j précédents" />
        <Kpi i={1} icon={ShoppingBag} label="Commandes 30 j" value={String(s.orders30)} sub={`panier moyen ${euro(s.avgBasket)}`} />
        <Kpi i={2} icon={Package} label="À préparer" value={String(s.toPrepare)} sub={`${s.upcomingCount} à venir au planning`} />
        <Kpi i={3} icon={Inbox} label="Messages non lus" value={String(s.newMessages)} sub={s.pendingPayment ? `${s.pendingPayment} paiement(s) en attente` : "tout est à jour"} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <Card title="Ventes">
          <RevenueChart series={s.series} />
          <div className="mt-6 grid grid-cols-3 gap-4 border-t border-noir/[0.06] pt-5 text-center">
            <div>
              <p className="text-xs text-noir/45">Aujourd&apos;hui</p>
              <p className="font-display text-2xl">{euro(s.revenueToday)}</p>
            </div>
            <div>
              <p className="text-xs text-noir/45">7 jours</p>
              <p className="font-display text-2xl">{euro(s.revenue7)}</p>
            </div>
            <div>
              <p className="text-xs text-noir/45">30 jours</p>
              <p className="font-display text-2xl">{euro(s.revenue30)}</p>
            </div>
          </div>
        </Card>
        <Card
          title="Aujourd'hui & demain"
          actions={
            <Link href="/admin/planning" className="flex items-center gap-1 text-xs text-aubergine-600 hover:underline">
              Planning <ArrowRight className="h-3 w-3" />
            </Link>
          }
        >
          {s.upcomingToday.length + s.upcomingTomorrow.length === 0 ? (
            <Empty text="Aucune livraison ni retrait prévu aujourd'hui ou demain." />
          ) : (
            <div className="space-y-4">
              {[
                ["Aujourd'hui", s.upcomingToday],
                ["Demain", s.upcomingTomorrow],
              ].map(([label, list]) =>
                (list as typeof s.upcomingToday).length ? (
                  <div key={label as string}>
                    <p className="mb-1 px-3 text-xs font-semibold uppercase tracking-wider text-noir/40">{label as string}</p>
                    {(list as typeof s.upcomingToday).map((o) => (
                      <OrderRow key={o.id} o={o} />
                    ))}
                  </div>
                ) : null,
              )}
            </div>
          )}
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card
          title="Dernières commandes"
          className="lg:col-span-2"
          actions={
            <Link href="/admin/commandes" className="flex items-center gap-1 text-xs text-aubergine-600 hover:underline">
              Toutes <ArrowRight className="h-3 w-3" />
            </Link>
          }
        >
          {s.recent.length ? s.recent.map((o) => <OrderRow key={o.id} o={o} />) : <Empty text="Les commandes apparaîtront ici." />}
        </Card>
        <div className="space-y-6">
          <Card title="Meilleures ventes (30 j)">
            {s.top.length ? (
              <ul className="space-y-3">
                {s.top.map((t, i) => (
                  <li key={t.name} className="text-sm">
                    <div className="flex justify-between">
                      <span>
                        {i + 1}. {t.name}
                      </span>
                      <span className="text-noir/50">{t.qty} vendu(s)</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-noir/[0.06]">
                      <motion.div className="h-full rounded-full bg-aubergine-500" initial={{ width: 0 }} animate={{ width: `${(t.qty / s.top[0].qty) * 100}%` }} transition={{ duration: 1, delay: 0.2 + i * 0.1 }} />
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty text="Pas encore de ventes." />
            )}
          </Card>
          <Card title="Modes de réception">
            <div className="space-y-2.5 text-sm">
              {Object.entries(s.modes).map(([k, v]) => (
                <div key={k} className="flex items-center gap-3">
                  <Truck className="h-4 w-4 text-noir/40" />
                  <span className="flex-1">{MODE_LABEL[k]}</span>
                  <span className="text-noir/50">{Math.round((v / totalModes) * 100)} %</span>
                </div>
              ))}
            </div>
          </Card>
          {s.lowStock.length > 0 && (
            <Card title="Stock bas">
              <ul className="space-y-2 text-sm">
                {s.lowStock.map((p) => (
                  <li key={p.id} className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    <span className="flex-1">{p.name}</span>
                    <Badge className="bg-amber-100 text-amber-800">{p.stock}</Badge>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
      <p className="text-center text-[0.7rem] text-noir/35">Dernière mise à jour : {frDateTime(new Date().toISOString())}</p>
    </div>
  );
}
