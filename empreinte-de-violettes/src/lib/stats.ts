import "server-only";
import { addDays, parisNow } from "./delivery";
import type { Message, Order, Product } from "./types";

export const REVENUE_STATUSES = ["paid", "preparing", "ready", "out_for_delivery", "delivered", "picked_up"];

const dayOf = (iso: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));

export function dashboardStats(orders: Order[], products: Product[], messages: Message[]) {
  const today = parisNow().date;
  const valid = orders.filter((o) => REVENUE_STATUSES.includes(o.status));
  const days = Array.from({ length: 30 }, (_, i) => addDays(today, i - 29));
  const series = days.map((d) => {
    const os = valid.filter((o) => dayOf(o.createdAt) === d);
    return { date: d, revenue: os.reduce((s, o) => s + o.total, 0), orders: os.length };
  });
  const sumSince = (n: number) => series.slice(-n).reduce((s, x) => s + x.revenue, 0);
  const prevMonth = valid.filter((o) => {
    const d = dayOf(o.createdAt);
    return d >= addDays(today, -59) && d < addDays(today, -29);
  });
  const last30 = valid.filter((o) => dayOf(o.createdAt) >= days[0]);
  const qty = new Map<string, { name: string; qty: number; revenue: number }>();
  for (const o of last30)
    for (const i of o.items) {
      const k = i.productId || "atelier";
      const cur = qty.get(k) || { name: i.name, qty: 0, revenue: 0 };
      cur.qty += i.quantity;
      cur.revenue += i.lineTotal;
      qty.set(k, cur);
    }
  const upcoming = orders
    .filter((o) => ["paid", "preparing", "ready", "out_for_delivery"].includes(o.status) && o.date >= today)
    .sort((a, b) => (a.date + a.slotId).localeCompare(b.date + b.slotId));
  const modes = { delivery: 0, pickup: 0, drive: 0 } as Record<string, number>;
  for (const o of last30) modes[o.mode] = (modes[o.mode] || 0) + 1;
  return {
    today,
    revenueToday: sumSince(1),
    revenue7: sumSince(7),
    revenue30: sumSince(30),
    revenuePrev30: prevMonth.reduce((s, o) => s + o.total, 0),
    orders30: last30.length,
    avgBasket: last30.length ? Math.round(sumSince(30) / last30.length) : 0,
    series,
    toPrepare: orders.filter((o) => o.status === "paid").length,
    upcomingToday: upcoming.filter((o) => o.date === today),
    upcomingTomorrow: upcoming.filter((o) => o.date === addDays(today, 1)),
    upcomingCount: upcoming.length,
    pendingPayment: orders.filter((o) => o.status === "pending_payment").length,
    newMessages: messages.filter((m) => m.status === "new").length,
    lowStock: products.filter((p) => p.active && p.stock != null && p.stock <= 3).map((p) => ({ id: p.id, name: p.name, stock: p.stock })),
    top: Array.from(qty.values())
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5),
    modes,
    recent: [...orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 6),
  };
}

export type DashboardStats = ReturnType<typeof dashboardStats>;
