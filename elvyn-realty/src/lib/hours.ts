import { site } from "@/config/site";

/** True when the office is open now (Dominican Republic time, UTC-4, no DST). */
export function isOfficeOpen(now = new Date()): boolean {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: "America/Santo_Domingo", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.weekday);
  const hm = `${parts.hour}:${parts.minute}`;
  return site.openingHours.some((o) => (o.days as readonly number[]).includes(day) && hm >= o.opens && hm < o.closes);
}
