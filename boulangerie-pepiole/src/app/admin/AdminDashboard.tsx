"use client";

import { useRouter } from "next/navigation";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { useEffect, useMemo, useState, useTransition } from "react";
import { SHOPS, getShop, type ShopId } from "@/lib/shops";
import { addDays, formatDateLong, formatTime, parisNow } from "@/lib/hours";
import { formatPrice } from "@/lib/catalog";
import type { OrderStatus, StoredOrder } from "@/lib/orders-store";
import { Monogram } from "@/components/ui/Logo";
import { logout, updateStatus } from "./actions";

const STATUS: Record<OrderStatus, { label: string; tone: string }> = {
  nouvelle: { label: "Nouvelle", tone: "bg-dore text-torref" },
  prete: { label: "Prête", tone: "bg-olive text-creme" },
  retiree: { label: "Retirée", tone: "bg-mie text-cafe/70" },
  annulee: { label: "Annulée", tone: "bg-red-100 text-red-700" },
};

type DayFilter = "aujourdhui" | "demain" | "avenir" | "passees" | "toutes";
const DAYS: { id: DayFilter; label: string }[] = [
  { id: "aujourdhui", label: "Aujourd'hui" },
  { id: "demain", label: "Demain" },
  { id: "avenir", label: "À venir" },
  { id: "passees", label: "Passées" },
  { id: "toutes", label: "Toutes" },
];

function Pills<T extends string>({
  id,
  value,
  options,
  onChange,
}: {
  id: string;
  value: T;
  options: { id: T; label: string; count?: number }[];
  onChange: (v: T) => void;
}) {
  return (
    <LayoutGroup id={id}>
      <div className="scrollbar-none flex gap-1 overflow-x-auto rounded-full bg-creme p-1 ring-1 ring-mie">
        {options.map((o) => {
          const on = o.id === value;
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => onChange(o.id)}
              className={`relative shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${on ? "text-creme" : "text-cafe/70 hover:text-cafe"}`}
            >
              {on && <motion.span layoutId="pill" className="absolute inset-0 rounded-full bg-cafe" transition={{ type: "spring", stiffness: 380, damping: 32 }} />}
              <span className="relative">
                {o.label}
                {o.count !== undefined && <span className="ml-1.5 opacity-60">{o.count}</span>}
              </span>
            </button>
          );
        })}
      </div>
    </LayoutGroup>
  );
}

export function AdminDashboard({ orders, error, liveShops }: { orders: StoredOrder[]; error: string | null; liveShops: ShopId[] }) {
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const [shop, setShop] = useState<ShopId | "toutes">("toutes");
  const [day, setDay] = useState<DayFilter>("aujourdhui");
  const [status, setStatus] = useState<OrderStatus | "actives" | "toutes">("actives");
  const [today, setToday] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<string>("");

  useEffect(() => {
    setToday(parisNow().date);
    setLastRefresh(new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }));
  }, [orders]);

  // Rafraîchissement automatique toutes les minutes
  useEffect(() => {
    const id = setInterval(() => startRefresh(() => router.refresh()), 60_000);
    return () => clearInterval(id);
  }, [router]);

  const byShop = useMemo(() => orders.filter((o) => shop === "toutes" || o.shop === shop), [orders, shop]);

  const byDay = useMemo(() => {
    if (!today) return byShop;
    const tomorrow = addDays(today, 1);
    return byShop.filter((o) => {
      const d = o.pickup.date;
      if (day === "aujourdhui") return d === today;
      if (day === "demain") return d === tomorrow;
      if (day === "avenir") return d >= today;
      if (day === "passees") return d < today;
      return true;
    });
  }, [byShop, day, today]);

  const visible = useMemo(
    () =>
      byDay
        .filter((o) => (status === "toutes" ? true : status === "actives" ? o.status === "nouvelle" || o.status === "prete" : o.status === status))
        .sort((a, b) => (day === "passees" ? -1 : 1) * `${a.pickup.date}${a.pickup.time}`.localeCompare(`${b.pickup.date}${b.pickup.time}`)),
    [byDay, status, day],
  );

  const count = (s: OrderStatus) => byDay.filter((o) => o.status === s).length;

  // Liste de production : quantités à préparer pour les commandes affichées (hors annulées / retirées)
  const production = useMemo(() => {
    const map = new Map<string, { name: string; unit: string | null; qty: number }>();
    for (const o of visible) {
      if (o.status === "annulee" || o.status === "retiree") continue;
      for (const it of o.items) {
        const cur = map.get(it.id) ?? { name: it.name, unit: it.unit, qty: 0 };
        cur.qty += it.qty;
        map.set(it.id, cur);
      }
    }
    return [...map.values()].sort((a, b) => b.qty - a.qty);
  }, [visible]);

  const revenue = visible.filter((o) => o.status !== "annulee").reduce((s, o) => s + o.total, 0);

  const change = async (orderNumber: string, next: OrderStatus) => {
    setPending(orderNumber);
    try {
      await updateStatus(orderNumber, next);
      startRefresh(() => router.refresh());
    } catch (e) {
      alert(`Impossible de mettre à jour : ${(e as Error).message}`);
    } finally {
      setPending(null);
    }
  };

  // Regroupement par jour de retrait
  const groups = useMemo(() => {
    const g = new Map<string, StoredOrder[]>();
    for (const o of visible) g.set(o.pickup.date, [...(g.get(o.pickup.date) ?? []), o]);
    return [...g.entries()];
  }, [visible]);

  return (
    <div className="min-h-screen bg-farine px-4 pb-24 pt-6 sm:px-8 print:bg-white print:p-0">
      <header className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-3">
          <Monogram className="h-11 w-11 text-croute" />
          <div>
            <p className="font-script text-xl leading-none text-caramel">Espace boutiques</p>
            <h1 className="font-display text-3xl tracking-tight">Commandes</h1>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-grege">{refreshing ? "Actualisation…" : lastRefresh && `Mis à jour à ${lastRefresh}`}</span>
          <button
            type="button"
            onClick={() => startRefresh(() => router.refresh())}
            className="inline-flex h-10 items-center rounded-full border border-mie bg-creme px-4 text-sm font-semibold transition hover:bg-mie"
          >
            <motion.span animate={refreshing ? { rotate: 360 } : { rotate: 0 }} transition={refreshing ? { repeat: Infinity, duration: 0.9, ease: "linear" } : {}} className="mr-2 inline-block">
              ↻
            </motion.span>
            Actualiser
          </button>
          <button type="button" onClick={() => window.print()} className="inline-flex h-10 items-center rounded-full border border-mie bg-creme px-4 text-sm font-semibold transition hover:bg-mie">
            Imprimer
          </button>
          <form action={logout}>
            <button type="submit" className="inline-flex h-10 items-center rounded-full bg-cafe px-4 text-sm font-semibold text-creme transition hover:bg-croute">
              Déconnexion
            </button>
          </form>
        </div>
      </header>

      <div className="mx-auto mt-6 max-w-7xl">
        {SHOPS.some((s) => !liveShops.includes(s.id)) && (
          <p className="mb-5 rounded-2xl border border-caramel/40 bg-dore/15 px-5 py-3 text-sm print:hidden">
            <strong>Mode démonstration</strong> pour{" "}
            {SHOPS.filter((s) => !liveShops.includes(s.id))
              .map((s) => s.short)
              .join(" et ")}{" "}
            : les clients voient un bandeau « commande de test » et ces commandes sont marquées « Test » ci-dessous. Pour
            les recevoir pour de vrai, ajoutez <code>ORDERS_LIVE=1</code> dans Vercel.
          </p>
        )}
        {error && <p className="mb-5 rounded-2xl bg-red-50 px-5 py-3 text-sm text-red-700">{error}</p>}

        <div className="flex flex-col gap-3 print:hidden lg:flex-row lg:items-center lg:justify-between">
          <Pills
            id="shop"
            value={shop}
            onChange={setShop}
            options={[{ id: "toutes" as const, label: "Toutes les boutiques" }, ...SHOPS.map((s) => ({ id: s.id, label: s.short }))]}
          />
          <Pills id="day" value={day} onChange={setDay} options={DAYS} />
        </div>
        <div className="mt-3 print:hidden">
          <Pills
            id="status"
            value={status}
            onChange={setStatus}
            options={[
              { id: "actives" as const, label: "À traiter", count: count("nouvelle") + count("prete") },
              ...(Object.keys(STATUS) as OrderStatus[]).map((s) => ({ id: s, label: STATUS[s].label, count: count(s) })),
              { id: "toutes" as const, label: "Toutes", count: byDay.length },
            ]}
          />
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-12">
          {/* Commandes */}
          <div className="lg:col-span-8">
            {groups.length === 0 ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-[2rem] bg-creme p-12 text-center ring-1 ring-mie">
                <p className="text-5xl">🥖</p>
                <p className="mt-4 font-display text-2xl">Aucune commande ici</p>
                <p className="mt-1 text-sm text-grege">Changez les filtres pour voir les autres commandes.</p>
              </motion.div>
            ) : (
              groups.map(([date, list]) => (
                <section key={date} className="mb-8 break-inside-avoid">
                  <h2 className="mb-3 font-display text-2xl first-letter:uppercase">
                    {formatDateLong(date)}
                    <span className="ml-2 text-base text-grege">
                      {list.length} commande{list.length > 1 ? "s" : ""}
                    </span>
                  </h2>
                  <ul className="space-y-3">
                    <AnimatePresence initial={false}>
                      {list.map((o) => {
                        const s = getShop(o.shop);
                        return (
                          <motion.li
                            key={o.orderNumber}
                            layout
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: pending === o.orderNumber ? 0.5 : 1, y: 0 }}
                            exit={{ opacity: 0, height: 0 }}
                            className={`break-inside-avoid rounded-[1.5rem] bg-creme p-5 ring-1 ring-mie print:rounded-none print:ring-0 print:border-b ${o.status === "annulee" ? "opacity-60" : ""}`}
                          >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="flex items-center gap-3">
                                <span className="grid h-14 w-16 place-items-center rounded-2xl bg-cafe font-display text-xl text-creme">{formatTime(o.pickup.time)}</span>
                                <div>
                                  <p className="font-display text-xl leading-tight">
                                    {o.customer.firstName} {o.customer.lastName}
                                  </p>
                                  <p className="text-sm">
                                    <a href={`tel:${o.customer.phone.replace(/\s/g, "")}`} className="font-semibold text-croute hover:underline">
                                      {o.customer.phone}
                                    </a>
                                    {o.customer.email && <span className="text-grege"> · {o.customer.email}</span>}
                                  </p>
                                </div>
                              </div>
                              <div className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-wider">
                                {o.demo && <span className="rounded-full bg-red-100 px-2.5 py-1 text-red-700">Test</span>}
                                <span className="rounded-full bg-farine px-2.5 py-1 text-cafe ring-1 ring-mie">{s.short}</span>
                                <span className={`rounded-full px-2.5 py-1 ${STATUS[o.status].tone}`}>{STATUS[o.status].label}</span>
                              </div>
                            </div>

                            <ul className="mt-4 grid gap-1 text-sm sm:grid-cols-2">
                              {o.items.map((it) => (
                                <li key={it.id}>
                                  <strong className="tabular-nums">{it.qty} ×</strong> {it.name}
                                  {it.unit && <span className="text-grege"> ({it.unit})</span>}
                                </li>
                              ))}
                            </ul>
                            {o.customer.note && <p className="mt-3 rounded-xl bg-dore/15 px-3 py-2 text-sm">📝 {o.customer.note}</p>}

                            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-mie pt-3">
                              <p className="text-xs text-grege">
                                {o.orderNumber} · reçue le{" "}
                                {new Date(o.createdAt).toLocaleString("fr-FR", { timeZone: "Europe/Paris", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} ·{" "}
                                <strong className="text-cafe">{formatPrice(Math.round(o.total * 100))}</strong>
                              </p>
                              <div className="flex flex-wrap gap-2 print:hidden">
                                {o.status === "nouvelle" && (
                                  <button type="button" disabled={!!pending} onClick={() => change(o.orderNumber, "prete")} className="rounded-full bg-olive px-4 py-2 text-sm font-semibold text-creme transition hover:opacity-90">
                                    ✓ Prête
                                  </button>
                                )}
                                {(o.status === "nouvelle" || o.status === "prete") && (
                                  <button type="button" disabled={!!pending} onClick={() => change(o.orderNumber, "retiree")} className="rounded-full bg-cafe px-4 py-2 text-sm font-semibold text-creme transition hover:bg-croute">
                                    Retirée
                                  </button>
                                )}
                                {o.status !== "annulee" && o.status !== "retiree" && (
                                  <button
                                    type="button"
                                    disabled={!!pending}
                                    onClick={() => confirm(`Annuler la commande ${o.orderNumber} ?`) && change(o.orderNumber, "annulee")}
                                    className="rounded-full border border-mie px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50"
                                  >
                                    Annuler
                                  </button>
                                )}
                                {(o.status === "retiree" || o.status === "annulee") && (
                                  <button type="button" disabled={!!pending} onClick={() => change(o.orderNumber, "nouvelle")} className="rounded-full border border-mie px-4 py-2 text-sm font-semibold transition hover:bg-mie">
                                    Rétablir
                                  </button>
                                )}
                              </div>
                            </div>
                          </motion.li>
                        );
                      })}
                    </AnimatePresence>
                  </ul>
                </section>
              ))
            )}
          </div>

          {/* À préparer */}
          <aside className="lg:col-span-4">
            <div className="sticky top-6 rounded-[2rem] bg-cafe p-6 text-creme print:static print:bg-white print:text-black">
              <p className="font-script text-2xl text-dore print:text-black">À préparer</p>
              <p className="text-xs text-creme/60 print:text-black">Commandes affichées, hors retirées et annulées</p>
              {production.length === 0 ? (
                <p className="mt-4 text-sm text-creme/70">Rien pour l&apos;instant.</p>
              ) : (
                <ul className="mt-4 space-y-1.5">
                  {production.map((p) => (
                    <li key={p.name} className="flex items-baseline justify-between gap-3 border-b border-creme/10 pb-1.5">
                      <span>
                        {p.name}
                        {p.unit && <span className="text-xs text-creme/50"> ({p.unit})</span>}
                      </span>
                      <span className="font-display text-xl tabular-nums text-dore print:text-black">{p.qty}</span>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-5 flex items-baseline justify-between border-t border-creme/15 pt-4">
                <span className="text-sm text-creme/60">
                  {visible.length} commande{visible.length > 1 ? "s" : ""}
                </span>
                <span className="font-display text-2xl">{formatPrice(Math.round(revenue * 100))}</span>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
