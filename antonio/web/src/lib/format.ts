import type { ActionStatus } from "@antonio/shared";

export const tz = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

export function fmtDateTime(iso: string, timeZone?: string) {
  return new Intl.DateTimeFormat("fr-FR", { timeZone, weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}
export function fmtTime(iso: string, timeZone?: string) {
  return new Intl.DateTimeFormat("fr-FR", { timeZone, hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}
export function fmtDay(iso: string, timeZone?: string) {
  return new Intl.DateTimeFormat("fr-FR", { timeZone, weekday: "long", day: "numeric", month: "long" }).format(new Date(iso));
}
export function fmtRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return "à l'instant";
  if (m < 60) return `il y a ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? "hier" : `il y a ${d} j`;
}

export const STATUS_TONE: Record<ActionStatus, string> = {
  proposed: "",
  awaiting_approval: "wait",
  authorized: "run",
  executing: "run",
  succeeded: "ok",
  failed: "bad",
  cancelled: "",
  uncertain: "unsure",
};
