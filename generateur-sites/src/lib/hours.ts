// Horaires et créneaux de retrait, toujours calculés à l'heure de Paris
// (le serveur Vercel tourne en UTC, le client peut être n'importe où).

export const TIME_ZONE = "Europe/Paris";

export type Range = readonly [open: string, close: string];

/** Ce dont les calculs d'horaires ont besoin (une boutique, voir shops.ts). */
export type Schedule = {
  /** 0 = dimanche … 6 = samedi */
  hours: Record<number, readonly Range[]>;
  closedDates: readonly string[];
};

export const DAY_NAMES = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

// Délai minimum entre la commande et le retrait (en minutes)
export const DEFAULT_LEAD_MINUTES = 120;
// Jusqu'à combien de jours à l'avance on peut commander
export const MAX_DAYS_AHEAD = 14;
// Pas des créneaux de retrait (minutes)
export const SLOT_STEP = 15;
// Pas de retrait dans les 15 dernières minutes avant la fermeture
export const LAST_SLOT_MARGIN = 15;

export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(":");
  return `${Number(h)}h${m === "00" ? "" : m}`;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** Heure murale de Paris, encodée comme un timestamp UTC (comparaisons simples). */
export function parisNow(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const y = get("year");
  const mo = get("month");
  const d = get("day");
  const h = get("hour");
  const mi = get("minute");
  return {
    wall: Date.UTC(y, mo - 1, d, h, mi),
    date: `${y}-${pad(mo)}-${pad(d)}`,
    minutes: h * 60 + mi,
    weekday: new Date(Date.UTC(y, mo - 1, d)).getUTCDay(),
  };
}

export function wallFrom(date: string, time: string) {
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  return Date.UTC(y, mo - 1, d, h, mi);
}

export function weekdayOf(date: string) {
  const [y, mo, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, mo - 1, d)).getUTCDay();
}

export function addDays(date: string, days: number) {
  const [y, mo, d] = date.split("-").map(Number);
  const t = new Date(Date.UTC(y, mo - 1, d + days));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

export function rangesFor(shop: Schedule, date: string): readonly Range[] {
  if (shop.closedDates.includes(date)) return [];
  return shop.hours[weekdayOf(date)] ?? [];
}

export type OpenStatus =
  | { open: true; closesAt: string }
  | { open: false; opensAt: string; when: "today" | "tomorrow" | string };

export function getOpenStatus(shop: Schedule, now = new Date()): OpenStatus {
  const p = parisNow(now);
  for (const [o, c] of rangesFor(shop, p.date)) {
    if (p.minutes >= toMinutes(o) && p.minutes < toMinutes(c)) return { open: true, closesAt: c };
  }
  for (const [o] of rangesFor(shop, p.date)) {
    if (p.minutes < toMinutes(o)) return { open: false, opensAt: o, when: "today" };
  }
  for (let i = 1; i <= 7; i++) {
    const d = addDays(p.date, i);
    const r = rangesFor(shop, d);
    if (r.length) {
      return { open: false, opensAt: r[0][0], when: i === 1 ? "tomorrow" : DAY_NAMES[weekdayOf(d)].toLowerCase() };
    }
  }
  return { open: false, opensAt: "06:30", when: "bientôt" };
}

/** Plage(s) d'un jour en texte : « 6h30 – 19h30 » ou « Fermé ». */
export function formatRanges(ranges: readonly Range[]) {
  return ranges.map(([o, c]) => `${formatTime(o)} – ${formatTime(c)}`).join(" · ") || "Fermé";
}

export function describeStatus(s: OpenStatus) {
  if (s.open) return `Ouvert · ferme à ${formatTime(s.closesAt)}`;
  const when = s.when === "today" ? "" : s.when === "tomorrow" ? " demain" : ` ${s.when}`;
  return `Fermé · ouvre${when} à ${formatTime(s.opensAt)}`;
}

/** Délai minimum (minutes) pour un panier donné. */
export function leadMinutesFor(leadHours: number[]) {
  return Math.max(DEFAULT_LEAD_MINUTES, ...leadHours.map((h) => h * 60));
}

export type Slot = { time: string; available: boolean };

export function slotsFor(shop: Schedule, date: string, leadMinutes: number, now = new Date()): Slot[] {
  const earliest = parisNow(now).wall + leadMinutes * 60_000;
  const slots: Slot[] = [];
  for (const [o, c] of rangesFor(shop, date)) {
    const start = toMinutes(o);
    const end = toMinutes(c) - LAST_SLOT_MARGIN;
    for (let m = Math.ceil(start / SLOT_STEP) * SLOT_STEP; m <= end; m += SLOT_STEP) {
      const time = `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
      slots.push({ time, available: wallFrom(date, time) >= earliest });
    }
  }
  return slots;
}

export function pickupDays(shop: Schedule, leadMinutes: number, now = new Date()) {
  const today = parisNow(now).date;
  const days: { date: string; hasSlots: boolean }[] = [];
  for (let i = 0; i < MAX_DAYS_AHEAD; i++) {
    const date = addDays(today, i);
    days.push({ date, hasSlots: slotsFor(shop, date, leadMinutes, now).some((s) => s.available) });
  }
  return days;
}

export function isValidSlot(shop: Schedule, date: string, time: string, leadMinutes: number, now = new Date()) {
  const today = parisNow(now).date;
  if (date < today || date > addDays(today, MAX_DAYS_AHEAD - 1)) return false;
  return slotsFor(shop, date, leadMinutes, now).some((s) => s.time === time && s.available);
}

export function formatDateLong(date: string) {
  const [y, mo, d] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, mo - 1, d)));
}

const SHORT_DAYS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

/** Horaires regroupés : [« Lun – Sam », « 6h30 – 19h30 »], [« Dim », « 7h – 13h15 »]. Semaine commençant le lundi. */
export function compactHours(shop: Schedule): [days: string, hours: string][] {
  const order = [1, 2, 3, 4, 5, 6, 0];
  const groups: { from: number; to: number; text: string }[] = [];
  for (const d of order) {
    const text = formatRanges(shop.hours[d] ?? []);
    const last = groups[groups.length - 1];
    if (last && last.text === text) last.to = d;
    else groups.push({ from: d, to: d, text });
  }
  return groups.map((g) => [g.from === g.to ? SHORT_DAYS[g.from] : `${SHORT_DAYS[g.from]} – ${SHORT_DAYS[g.to]}`, g.text]);
}
