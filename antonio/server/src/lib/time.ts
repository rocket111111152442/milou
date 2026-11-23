/**
 * Fuseaux horaires sans dépendance : Intl gère les changements d'heure (DST).
 * Toutes les dates sont stockées en UTC ; les règles horaires (heures de travail,
 * heure du briefing) sont évaluées dans le fuseau de l'utilisateur.
 */

export interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: number; // 0 = dimanche
}

const fmtCache = new Map<string, Intl.DateTimeFormat>();
function fmt(tz: string) {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      weekday: "short",
    });
    fmtCache.set(tz, f);
  }
  return f;
}

const WD: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export function zonedParts(date: Date, tz: string): ZonedParts {
  const parts = Object.fromEntries(fmt(tz).formatToParts(date).map((p) => [p.type, p.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour) % 24,
    minute: Number(parts.minute),
    weekday: WD[parts.weekday as string] ?? 0,
  };
}

/** Convertit une heure locale (dans tz) en instant UTC, en tenant compte du changement d'heure. */
export function zonedToUtc(year: number, month: number, day: number, hour: number, minute: number, tz: string): Date {
  let guess = Date.UTC(year, month - 1, day, hour, minute);
  for (let i = 0; i < 3; i++) {
    const p = zonedParts(new Date(guess), tz);
    const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
    const target = Date.UTC(year, month - 1, day, hour, minute);
    const diff = target - asUtc;
    if (diff === 0) break;
    guess += diff;
  }
  return new Date(guess);
}

export function parseHHMM(s: string): { h: number; m: number } {
  const [h, m] = s.split(":").map(Number);
  return { h: h || 0, m: m || 0 };
}

export function localDateString(date: Date, tz: string): string {
  const p = zonedParts(date, tz);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

export function startOfLocalDay(date: Date, tz: string): Date {
  const p = zonedParts(date, tz);
  return zonedToUtc(p.year, p.month, p.day, 0, 0, tz);
}

export function addDaysLocal(date: Date, days: number, tz: string): Date {
  const p = zonedParts(date, tz);
  const d = new Date(Date.UTC(p.year, p.month - 1, p.day + days));
  return zonedToUtc(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), p.hour, p.minute, tz);
}

export interface WorkPrefs {
  timezone: string;
  workDays: number[];
  workStart: string;
  workEnd: string;
}

export function withinWorkHours(start: Date, end: Date, prefs: WorkPrefs): boolean {
  const s = zonedParts(start, prefs.timezone);
  const e = zonedParts(new Date(end.getTime() - 1), prefs.timezone);
  if (!prefs.workDays.includes(s.weekday)) return false;
  if (s.day !== e.day) return false;
  const ws = parseHHMM(prefs.workStart);
  const we = parseHHMM(prefs.workEnd);
  const sm = s.hour * 60 + s.minute;
  const em = e.hour * 60 + e.minute + 1;
  return sm >= ws.h * 60 + ws.m && em <= we.h * 60 + we.m;
}

/**
 * Créneaux libres : horaires de travail, durée, temps de pause autour des événements.
 * `busy` doit contenir des intervalles UTC.
 */
export function findFreeSlots(opts: {
  from: Date;
  days: number;
  durationMin: number;
  bufferMin: number;
  prefs: WorkPrefs;
  busy: { start: Date; end: Date }[];
  count: number;
  stepMin?: number;
  dayFilter?: (p: ZonedParts) => boolean;
  minHour?: number;
  maxHour?: number;
}): { start: Date; end: Date }[] {
  const { prefs } = opts;
  const step = (opts.stepMin ?? 30) * 60_000;
  const dur = opts.durationMin * 60_000;
  const buf = opts.bufferMin * 60_000;
  const slots: { start: Date; end: Date }[] = [];
  const ws = parseHHMM(prefs.workStart);
  const we = parseHHMM(prefs.workEnd);
  for (let d = 0; d < opts.days && slots.length < opts.count; d++) {
    const dayRef = addDaysLocal(opts.from, d, prefs.timezone);
    const p = zonedParts(dayRef, prefs.timezone);
    if (!prefs.workDays.includes(p.weekday)) continue;
    if (opts.dayFilter && !opts.dayFilter(p)) continue;
    const startH = Math.max(ws.h + ws.m / 60, opts.minHour ?? 0);
    const endH = Math.min(we.h + we.m / 60, opts.maxHour ?? 24);
    let t = zonedToUtc(p.year, p.month, p.day, Math.floor(startH), Math.round((startH % 1) * 60), prefs.timezone).getTime();
    const dayEnd = zonedToUtc(p.year, p.month, p.day, Math.floor(endH), Math.round((endH % 1) * 60), prefs.timezone).getTime();
    // Arrondi au pas suivant et pas de créneau dans le passé.
    const earliest = opts.from.getTime() + 60 * 60_000;
    while (t + dur <= dayEnd && slots.length < opts.count) {
      if (t >= earliest) {
        const s = t;
        const e = t + dur;
        const clash = opts.busy.some((b) => s < b.end.getTime() + buf && e > b.start.getTime() - buf);
        const overlapsChosen = slots.some((x) => s < x.end.getTime() + buf && e > x.start.getTime() - buf);
        if (!clash && !overlapsChosen) slots.push({ start: new Date(s), end: new Date(e) });
      }
      t += step;
    }
  }
  return slots;
}

export function formatDateTimeFr(date: Date, tz: string): string {
  return new Intl.DateTimeFormat("fr-FR", { timeZone: tz, weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).format(date);
}

export function formatTimeFr(date: Date, tz: string): string {
  return new Intl.DateTimeFormat("fr-FR", { timeZone: tz, hour: "2-digit", minute: "2-digit" }).format(date);
}
