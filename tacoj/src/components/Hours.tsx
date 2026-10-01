"use client";
import { useEffect, useState } from "react";
import { brand, type Location } from "@/data/site";
import { formatRange, getStatus, type OpenStatus } from "@/lib/hours";

/** Live open/closed status in Manila time. Returns null until mounted (avoids SSR mismatch). */
export function useBranchStatus(location: Location) {
  const [status, setStatus] = useState<OpenStatus | null>(null);
  useEffect(() => {
    const tick = () => setStatus(getStatus(location, brand.timeZone));
    tick();
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, [location]);
  return status;
}

export function StatusPill({ location, tone = "light" }: { location: Location; tone?: "light" | "dark" }) {
  const status = useBranchStatus(location);
  const pending = !status;
  const open = status?.isOpen;
  const toneCls = tone === "dark" ? "bg-char/90 text-cream" : "bg-cream text-char";
  return (
    <span
      className={`inline-flex min-h-[30px] items-center gap-2 rounded-full px-3 py-1 text-[13px] font-bold ${toneCls}`}
      aria-live="polite"
    >
      <span
        className={`relative inline-block h-2.5 w-2.5 rounded-full ${pending ? "bg-current opacity-30" : open ? "bg-emerald-500" : "bg-chili-light"}`}
        aria-hidden
      >
        {open && <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400 opacity-70" />}
      </span>
      {pending ? "Checking hours…" : status.label}
    </span>
  );
}

/** "Today · Friday — 1:00 PM – 2:00 AM" with a static fallback before hydration. */
export function TodayHours({ location, className = "" }: { location: Location; className?: string }) {
  const status = useBranchStatus(location);
  if (!status) {
    return (
      <p className={className}>
        <span className="block text-[13px] font-bold uppercase tracking-[0.16em] opacity-70">Hours</span>
        {location.hours.map((r) => (
          <span key={r.label} className="block font-semibold">
            {r.label}: {formatRange(r)}
          </span>
        ))}
      </p>
    );
  }
  return (
    <p className={className}>
      <span className="block text-[13px] font-bold uppercase tracking-[0.16em] opacity-70">Today · {status.dayName}</span>
      <span className="block text-xl font-extrabold tracking-tight sm:text-2xl">
        {status.todayRule ? formatRange(status.todayRule) : "Closed"}
      </span>
    </p>
  );
}

/** Full weekly hours with today's rule highlighted. */
export function HoursTable({ location, tone = "light" }: { location: Location; tone?: "light" | "dark" }) {
  const status = useBranchStatus(location);
  const hl = tone === "dark" ? "bg-chili/25 ring-1 ring-chili-light/60" : "bg-mango/70 ring-1 ring-char/15";
  return (
    <dl className="space-y-1.5">
      {location.hours.map((r) => {
        const isToday = status ? r.days.includes(status.day) : false;
        return (
          <div key={r.label} className={`flex flex-wrap items-baseline justify-between gap-x-4 rounded-xl px-3 py-2 transition ${isToday ? hl : ""}`}>
            <dt className="font-semibold">
              {r.label}
              {isToday && <span className="ml-2 rounded-full bg-chili px-2 py-0.5 align-middle text-[11px] font-extrabold uppercase tracking-wider text-white">Today</span>}
            </dt>
            <dd className="font-extrabold tabular-nums">{formatRange(r)}</dd>
          </div>
        );
      })}
    </dl>
  );
}
