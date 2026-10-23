"use client";

import { animate, useInView } from "framer-motion";
import { useEffect, useRef, useState } from "react";

const NUM = /\d{1,3}(?:[\s  ]\d{3})+(?:[.,]\d+)?|\d+(?:[.,]\d+)?/;

/** Anime le premier nombre trouvé dans la chaîne (« 4,8/5 », « 80 % », « 1 234,50 € », « 2022 »). */
export function Counter({ value, className, duration = 2 }: { value: string; className?: string; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const m = value.match(NUM);
  const raw = m?.[0] ?? "";
  const clean = raw.replace(/[\s  ]/g, "").replace(",", ".");
  const target = m ? parseFloat(clean) : 0;
  const decimals = clean.includes(".") ? clean.split(".")[1].length : 0;
  const grouped = /[\s  ]/.test(raw);
  const isYear = !grouped && !decimals && target > 1900 && target < 2100;
  const fmt = (v: number) =>
    grouped ? v.toLocaleString("fr-FR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) : v.toFixed(decimals).replace(".", ",");
  const [display, setDisplay] = useState(m ? value.replace(raw, isYear ? raw : fmt(0)) : value);

  useEffect(() => {
    if (!m) {
      setDisplay(value);
      return;
    }
    if (!inView) return;
    const from = isYear ? target - 60 : 0;
    const ctrl = animate(from, target, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setDisplay(value.replace(raw, fmt(v))),
    });
    return () => ctrl.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView, value]);

  return (
    <span ref={ref} className={className}>
      {display}
    </span>
  );
}
