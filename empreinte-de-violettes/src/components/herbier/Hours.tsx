"use client";

import { cn } from "@/lib/cn";
import { DAYS, hhmm } from "@/lib/format";
import type { DayHours } from "@/lib/types";
import { useParisWeekday } from "./OpenNow";

const ORDER = [2, 3, 4, 5, 6, 0, 1];

/** Tableau des horaires avec points de conduite ; le jour courant est en italique. */
export function Hours({ hours, className }: { hours: DayHours[]; className?: string }) {
  const today = useParisWeekday();
  return (
    <dl className={cn("space-y-2 font-text text-[1.02rem]", className)}>
      {ORDER.map((d) => {
        const h = hours.find((x) => x.day === d);
        const on = d === today;
        return (
          <div key={d} className={cn("flex items-baseline", on && "italic")}>
            <dt className="shrink-0">
              {DAYS[d]}
              {on && <span className="ml-2 text-[0.8rem] text-plum">aujourd&apos;hui</span>}
            </dt>
            <span className="leader" />
            <dd className={cn("tab shrink-0 text-right", !on && "text-ink-soft")}>{!h || h.closed ? <span className="italic">fermé</span> : h.ranges.map((r) => `${hhmm(r.from)} – ${hhmm(r.to)}`).join(" · ")}</dd>
          </div>
        );
      })}
    </dl>
  );
}
