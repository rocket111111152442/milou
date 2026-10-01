import type { HoursRule, Location, Weekday } from "@/data/site";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function toMinutes(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/** "22:00" → "10:00 PM", "00:00" → "12:00 AM" */
export function formatTime(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  const suffix = h >= 12 && h < 24 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
}

export function formatRange(rule: Pick<HoursRule, "open" | "close">) {
  return `${formatTime(rule.open)} – ${formatTime(rule.close)}`;
}

export function ruleForDay(location: Location, day: Weekday) {
  return location.hours.find((r) => r.days.includes(day));
}

/** Current weekday + minutes past midnight in the restaurant's time zone. */
export function zonedNow(timeZone: string, date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday")) as Weekday;
  return { day, minutes: Number(get("hour")) * 60 + Number(get("minute")) };
}

export type OpenStatus = {
  day: Weekday;
  dayName: string;
  todayRule?: HoursRule;
  isOpen: boolean;
  /** Short status line, e.g. "Open now · until 2:00 AM" */
  label: string;
};

export function getStatus(location: Location, timeZone: string, date = new Date()): OpenStatus {
  const { day, minutes } = zonedNow(timeZone, date);
  const todayRule = ruleForDay(location, day);
  const yesterday = ((day + 6) % 7) as Weekday;
  const yRule = ruleForDay(location, yesterday);

  // Still inside last night's after-midnight window?
  if (yRule) {
    const o = toMinutes(yRule.open);
    const c = toMinutes(yRule.close);
    if (c <= o && minutes < c) {
      return { day, dayName: DAY_NAMES[day], todayRule, isOpen: true, label: `Open now · until ${formatTime(yRule.close)}` };
    }
  }

  if (todayRule) {
    const o = toMinutes(todayRule.open);
    let c = toMinutes(todayRule.close);
    if (c <= o) c += 24 * 60;
    if (minutes >= o && minutes < c) {
      return { day, dayName: DAY_NAMES[day], todayRule, isOpen: true, label: `Open now · until ${formatTime(todayRule.close)}` };
    }
    if (minutes < o) {
      return { day, dayName: DAY_NAMES[day], todayRule, isOpen: false, label: `Closed · opens ${formatTime(todayRule.open)}` };
    }
  }

  const tomorrow = ((day + 1) % 7) as Weekday;
  const tRule = ruleForDay(location, tomorrow);
  return {
    day,
    dayName: DAY_NAMES[day],
    todayRule,
    isOpen: false,
    label: tRule ? `Closed · opens tomorrow ${formatTime(tRule.open)}` : "Closed today",
  };
}
