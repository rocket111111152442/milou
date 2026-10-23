import type { DeliverySettings, DeliveryZone, FulfillmentMode, Order, Settings } from "./types";

const TZ = "Europe/Paris";

/** Date et heure actuelles à Paris (le serveur tourne en UTC sur Vercel). */
export function parisNow(at = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "short",
  }).formatToParts(at);
  const get = (t: string) => parts.find((p) => p.type === t)?.value || "";
  const hour = Number(get("hour")) % 24;
  const date = `${get("year")}-${get("month")}-${get("day")}`;
  return { date, minutes: hour * 60 + Number(get("minute")), weekday: weekdayOf(date) };
}

export function weekdayOf(isoDate: string) {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function addDays(isoDate: string, n: number) {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}

const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
};

const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

export function findZone(delivery: DeliverySettings, postcode: string, city?: string): DeliveryZone | null {
  const pc = postcode.replace(/\s/g, "");
  const zones = delivery.zones.filter((z) => z.active);
  const byPc = zones.filter((z) => z.postcodes.includes(pc));
  if (byPc.length <= 1 || !city) return byPc[0] || null;
  // code postal partagé : départage par la ville
  const c = normalize(city);
  return byPc.find((z) => z.cities.some((x) => normalize(x) === c)) || byPc[0];
}

export function deliveryFeeFor(zone: DeliveryZone, subtotal: number) {
  if (zone.freeFrom != null && subtotal >= zone.freeFrom) return 0;
  return zone.fee;
}

export interface SlotAvailability {
  id: string;
  label: string;
  available: boolean;
  reason?: string;
}
export interface DayAvailability {
  date: string;
  weekday: number;
  open: boolean;
  reason?: string;
  slots: SlotAvailability[];
}

export function isModeEnabled(delivery: DeliverySettings, mode: FulfillmentMode) {
  return mode === "delivery" ? delivery.deliveryEnabled : mode === "pickup" ? delivery.pickupEnabled : delivery.driveEnabled;
}

function closureFor(settings: Settings, date: string) {
  return settings.closures.find((c) => c.from <= date && date <= c.to);
}

/** Calcule les jours/créneaux disponibles pour un mode donné. */
export function availability(
  delivery: DeliverySettings,
  settings: Settings,
  mode: FulfillmentMode,
  orders: Pick<Order, "date" | "slotId" | "status">[] = [],
  days = 21,
  at = new Date(),
): DayAvailability[] {
  const now = parisNow(at);
  const counts = new Map<string, number>();
  for (const o of orders) {
    if (o.status === "cancelled" || o.status === "refunded") continue;
    const k = `${o.date}|${o.slotId}`;
    counts.set(k, (counts.get(k) || 0) + 1);
  }
  const out: DayAvailability[] = [];
  const total = Math.min(days, delivery.maxDaysAhead + 1);
  for (let i = 0; i < total; i++) {
    const date = addDays(now.date, i);
    const weekday = weekdayOf(date);
    const closure = closureFor(settings, date);
    let reason: string | undefined;
    if (delivery.closedDays.includes(weekday)) reason = "Boutique fermée";
    else if (delivery.blackoutDates.includes(date)) reason = "Jour non travaillé";
    else if (closure) reason = closure.label || "Fermeture exceptionnelle";
    const slots: SlotAvailability[] = delivery.slots
      .filter((s) => s.days.includes(weekday) && s.modes.includes(mode))
      .map((s) => {
        if (reason) return { id: s.id, label: s.label, available: false, reason };
        if (i === 0) {
          const ready = now.minutes + delivery.leadTimeHours * 60;
          if (ready > toMin(s.to) - 60) return { id: s.id, label: s.label, available: false, reason: "Trop tard aujourd'hui" };
          if (mode === "delivery" && now.minutes > toMin(delivery.sameDayCutoff))
            return { id: s.id, label: s.label, available: false, reason: "Commande après l'heure limite" };
        }
        const used = counts.get(`${date}|${s.id}`) || 0;
        if (s.capacity != null && used >= s.capacity) return { id: s.id, label: s.label, available: false, reason: "Complet" };
        return { id: s.id, label: s.label, available: true };
      });
    out.push({ date, weekday, open: !reason && slots.some((s) => s.available), reason, slots });
  }
  return out;
}

export function isSlotAvailable(
  delivery: DeliverySettings,
  settings: Settings,
  mode: FulfillmentMode,
  date: string,
  slotId: string,
  orders: Pick<Order, "date" | "slotId" | "status">[],
) {
  const days = availability(delivery, settings, mode, orders, delivery.maxDaysAhead + 1);
  const day = days.find((d) => d.date === date);
  const slot = day?.slots.find((s) => s.id === slotId);
  return { ok: !!slot?.available, slot, reason: slot?.reason || day?.reason || "Créneau indisponible" };
}

/** La boutique est-elle ouverte maintenant ? */
export function openState(settings: Settings, at = new Date()) {
  const now = parisNow(at);
  const today = settings.hours.find((h) => h.day === now.weekday);
  if (closureFor(settings, now.date)) return { open: false, label: "Fermeture exceptionnelle" };
  if (!today || today.closed) return { open: false, label: "Fermé aujourd'hui" };
  for (const r of today.ranges) {
    if (now.minutes >= toMin(r.from) && now.minutes < toMin(r.to)) {
      return { open: true, label: `Ouvert jusqu'à ${r.to.replace(":", " h ").replace(" h 00", " h")}` };
    }
  }
  const next = today.ranges.find((r) => toMin(r.from) > now.minutes);
  if (next) return { open: false, label: `Ouvre à ${next.from.replace(":", " h ").replace(" h 00", " h")}` };
  return { open: false, label: "Fermé pour aujourd'hui" };
}
