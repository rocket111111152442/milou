"use client";

import { useEffect, useState } from "react";
import { hhmm } from "@/lib/format";
import type { DayHours } from "@/lib/types";

const DAY_NAMES = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];

function parisNow() {
  const p = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Paris", weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date());
  const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.find((x) => x.type === "weekday")?.value || "");
  const min = (Number(p.find((x) => x.type === "hour")?.value) % 24) * 60 + Number(p.find((x) => x.type === "minute")?.value);
  return { wd, min };
}
const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

/** « Ouvert en ce moment, jusqu'à 12 h 30 » — calculé à l'heure de Paris, côté navigateur. */
export function OpenNow({ hours, className }: { hours: DayHours[]; className?: string }) {
  const [text, setText] = useState<{ open: boolean; line: string } | null>(null);
  useEffect(() => {
    const compute = () => {
      const { wd, min } = parisNow();
      const today = hours.find((h) => h.day === wd);
      const range = today && !today.closed ? today.ranges.find((r) => min >= toMin(r.from) && min < toMin(r.to)) : undefined;
      if (range) return setText({ open: true, line: `Ouvert en ce moment, jusqu'à ${hhmm(range.to)}` });
      // prochaine ouverture
      for (let k = 0; k < 8; k++) {
        const d = (wd + k) % 7;
        const h = hours.find((x) => x.day === d);
        if (!h || h.closed) continue;
        const next = h.ranges.find((r) => k > 0 || toMin(r.from) > min);
        if (next) return setText({ open: false, line: `Fermé · ouvre ${k === 0 ? "à" : k === 1 ? "demain à" : `${DAY_NAMES[d]} à`} ${hhmm(next.from)}` });
      }
      setText({ open: false, line: "Fermé pour le moment" });
    };
    compute();
    const t = setInterval(compute, 60_000);
    return () => clearInterval(t);
  }, [hours]);
  if (!text) return <span className={className}>&nbsp;</span>;
  return (
    <span className={className}>
      <span className={`mr-2 inline-block h-[7px] w-[7px] rounded-full align-middle ${text.open ? "bg-[#5d7a4e]" : "bg-ink-faint"}`} aria-hidden />
      {text.line}
    </span>
  );
}

/** Indique le jour courant (à l'heure de Paris) dans un tableau d'horaires. */
export function useParisWeekday() {
  const [wd, setWd] = useState<number | null>(null);
  useEffect(() => setWd(parisNow().wd), []);
  return wd;
}
