import { TZ } from "./site";

const time = new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
const dayLong = new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" });
const dayShort = new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, weekday: "short" });
const dayNum = new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, day: "2-digit" });
const monthShort = new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, month: "short" });
const keyFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });

export const fmtTime = (iso: string) => time.format(new Date(iso)).replace(":", "h");
/** Heure HH:MM à Paris, pour les champs <input type="time">. */
export const parisHHMM = (iso: string) => time.format(new Date(iso));
export const fmtDayLong = (iso: string) => dayLong.format(new Date(iso));
export const fmtDayShort = (d: Date) => dayShort.format(d).replace(".", "");
export const fmtDayNum = (d: Date) => dayNum.format(d);
export const fmtMonthShort = (d: Date) => monthShort.format(d).replace(".", "");
/** Clé YYYY-MM-DD du jour à Paris. */
export const dayKey = (d: Date | string) => keyFmt.format(typeof d === "string" ? new Date(d) : d);

/** Convertit une date + heure locales de Paris en ISO UTC. */
export function parisToIso(date: string, hhmm: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = hhmm.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const offset = parisOffsetMinutes(new Date(guess));
  return new Date(guess - offset * 60_000).toISOString();
}

function parisOffsetMinutes(at: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(at);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"));
  return Math.round((asUtc - at.getTime()) / 60_000);
}

/** Lundi (YYYY-MM-DD, Paris) de la semaine contenant `date`. */
export function mondayOf(date: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dow);
  return d.toISOString().slice(0, 10);
}

export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
