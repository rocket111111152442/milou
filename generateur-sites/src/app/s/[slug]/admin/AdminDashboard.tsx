"use client";

import { useRouter } from "next/navigation";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { type ShopId } from "@/lib/shops";
import { useSiteData } from "@/components/SettingsProvider";
import { useHref } from "@/components/TLink";
import { addDays, formatDateLong, formatTime, parisNow } from "@/lib/hours";
import { formatPrice } from "@/lib/catalog";
import type { OrderStatus, StoredOrder } from "@/lib/orders-store";
import { deleteOrder, updateStatus } from "./actions";

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
  const { slug, site, shops: SHOPS, shopById } = useSiteData();
  const href = useHref();
  const [refreshing, startRefresh] = useTransition();
  const [shop, setShop] = useState<ShopId | "toutes">("toutes");
  const [day, setDay] = useState<DayFilter>("avenir");
  const [status, setStatus] = useState<OrderStatus | "actives" | "toutes">("actives");
  const [today, setToday] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<string>("");

  useEffect(() => {
    setToday(parisNow().date);
    setLastRefresh(new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" }));
  }, [orders]);

  // Nouvelle commande arrivée depuis le dernier affichage : son + compteur dans l'onglet
  const known = useRef<Set<string> | null>(null);
  const [fresh, setFresh] = useState<string[]>([]);
  useEffect(() => {
    const ids = orders.map((o) => o.orderNumber);
    if (known.current) {
      const added = ids.filter((id) => !known.current!.has(id));
      if (added.length) {
        setFresh((f) => [...f, ...added]);
        chime();
      }
    }
    known.current = new Set(ids);
  }, [orders]);
  useEffect(() => {
    document.title = fresh.length ? `(${fresh.length}) Nouvelle commande !` : `Commandes · ${site.name}`;
  }, [fresh]);
  useEffect(() => {
    const clear = () => document.visibilityState === "visible" && setTimeout(() => setFresh([]), 4000);
    document.addEventListener("visibilitychange", clear);
    window.addEventListener("focus", clear);
    return () => {
      document.removeEventListener("visibilitychange", clear);
      window.removeEventListener("focus", clear);
    };
  }, []);

  // Rafraîchissement automatique toutes les minutes
  useEffect(() => {
    const id = setInterval(() => startRefresh(() => router.refresh()), 60_000);
    return () => clearInterval(id);
  }, [router]);

  const byShop = useMemo(() => orders.filter((o) => shop === "toutes" || o.shop === shop), [orders, shop]);

  const inDay = useMemo(() => {
    const tomorrow = today ? addDays(today, 1) : null;
    return (o: StoredOrder, f: DayFilter) => {
      const d = o.pickup.date;
      if (!today || f === "toutes") return true;
      if (f === "aujourdhui") return d === today;
      if (f === "demain") return d === tomorrow;
      if (f === "avenir") return d >= today;
      return d < today;
    };
  }, [today]);

  const byDay = useMemo(() => byShop.filter((o) => inDay(o, day)), [byShop, day, inDay]);

  // Nouvelles commandes cachées par les filtres actuels : on le signale pour qu'aucune ne passe inaperçue
  const statusShowsNew = status === "toutes" || status === "actives" || status === "nouvelle";
  const hiddenNew = orders.filter((o) => o.status === "nouvelle" && !(statusShowsNew && (shop === "toutes" || o.shop === shop) && inDay(o, day))).length;
  const showAll = () => {
    setShop("toutes");
    setDay("toutes");
    setStatus("actives");
  };

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
    const map = new Map<string, { name: string; unit: string | null; options: string | null; qty: number }>();
    for (const o of visible) {
      if (o.status === "annulee" || o.status === "retiree") continue;
      for (const it of o.items) {
        const k = `${it.id}|${it.options ?? ""}`;
        const cur = map.get(k) ?? { name: it.name, unit: it.unit, options: it.options ?? null, qty: 0 };
        cur.qty += it.qty;
        map.set(k, cur);
      }
    }
    return [...map.values()].sort((a, b) => b.qty - a.qty);
  }, [visible]);

  const revenue = visible.filter((o) => o.status !== "annulee").reduce((s, o) => s + o.total, 0);

  const remove = async (o: StoredOrder) => {
    if (!confirm(`Supprimer définitivement la commande ${o.orderNumber} (${o.customer.firstName} ${o.customer.lastName}) ?\n\nElle disparaîtra de l'admin et ne pourra pas être récupérée.`)) return;
    setPending(o.orderNumber);
    try {
      await deleteOrder(slug, o.orderNumber);
      startRefresh(() => router.refresh());
    } catch (e) {
      alert(`Impossible de supprimer : ${(e as Error).message}`);
    } finally {
      setPending(null);
    }
  };

  const change = async (orderNumber: string, next: OrderStatus) => {
    setPending(orderNumber);
    try {
      await updateStatus(slug, orderNumber, next);
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
    <div className="px-4 pb-24 pt-6 sm:px-8 print:p-0">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 print:hidden">
        <h1 className="font-display text-3xl tracking-tight">Commandes</h1>
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
        </div>
      </div>

      <div className="mx-auto mt-6 max-w-7xl">
        {SHOPS.some((s) => !liveShops.includes(s.id)) && (
          <p className="mb-5 rounded-2xl border border-caramel/40 bg-dore/15 px-5 py-3 text-sm print:hidden">
            <strong>Mode démonstration</strong> pour{" "}
            {SHOPS.filter((s) => !liveShops.includes(s.id))
              .map((s) => s.short)
              .join(" et ")}{" "}
            : les clients voient un bandeau « commande de test » et ces commandes sont marquées « Test » ci-dessous. Pour
            les recevoir pour de vrai, activez la boutique dans <a href={href("/admin/reglages")} className="font-semibold underline">Réglages</a>.
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
          <Pills id="day" value={day} onChange={setDay} options={DAYS.map((d) => ({ ...d, count: byShop.filter((o) => o.status === "nouvelle" && inDay(o, d.id)).length || undefined }))} />
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

        {hiddenNew > 0 && (
          <button
            type="button"
            onClick={showAll}
            className="mt-4 flex w-full items-center justify-between gap-3 rounded-2xl bg-croute px-5 py-3 text-left text-sm font-semibold text-creme shadow-lg transition hover:bg-cafe print:hidden"
          >
            <span>
              🔔 {hiddenNew} nouvelle{hiddenNew > 1 ? "s" : ""} commande{hiddenNew > 1 ? "s" : ""} non affichée{hiddenNew > 1 ? "s" : ""} avec ces filtres
            </span>
            <span className="underline underline-offset-2">Tout afficher</span>
          </button>
        )}

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
                        const s = shopById(o.shop);
                        return (
                          <motion.li
                            key={o.orderNumber}
                            layout
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: pending === o.orderNumber ? 0.5 : 1, y: 0 }}
                            exit={{ opacity: 0, height: 0 }}
                            className={`break-inside-avoid rounded-[1.5rem] bg-creme p-5 ring-1 ${fresh.includes(o.orderNumber) ? "ring-2 ring-croute" : "ring-mie"} print:rounded-none print:ring-0 print:border-b ${o.status === "annulee" ? "opacity-60" : ""}`}
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
                              {o.items.map((it, n) => (
                                <li key={`${it.id}-${n}`}>
                                  <strong className="tabular-nums">{it.qty} ×</strong> {it.name}
                                  {it.unit && <span className="text-grege"> ({it.unit})</span>}
                                  {it.options && <span className="block text-xs text-cafe/70">{it.options}</span>}
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
                                <button
                                  type="button"
                                  disabled={!!pending}
                                  onClick={() => remove(o)}
                                  title="Supprimer définitivement"
                                  aria-label={`Supprimer définitivement la commande ${o.orderNumber}`}
                                  className="rounded-full px-3 py-2 text-sm text-grege transition hover:bg-red-50 hover:text-red-700"
                                >
                                  🗑
                                </button>
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
                    <li key={`${p.name}|${p.options}`} className="flex items-baseline justify-between gap-3 border-b border-creme/10 pb-1.5">
                      <span>
                        {p.name}
                        {p.unit && <span className="text-xs text-creme/50"> ({p.unit})</span>}
                        {p.options && <span className="block text-xs text-creme/60 print:text-black">{p.options}</span>}
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

/** Petit carillon (deux notes) joué à l'arrivée d'une commande. */
function chime() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    [880, 1318.5].forEach((freq, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = freq;
      const t = ctx.currentTime + i * 0.22;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.4, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
      o.connect(g).connect(ctx.destination);
      o.start(t);
      o.stop(t + 0.65);
    });
  } catch {
    // Son bloqué par le navigateur tant qu'on n'a pas interagi avec la page
  }
}
