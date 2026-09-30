"use client";

import { animate, useInView } from "motion/react";
import { useEffect, useRef, useState } from "react";

function Counter({ to, suffix = "" }: { to: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!inView) return;
    const c = animate(0, to, { duration: 1.8, ease: [0.22, 1, 0.36, 1], onUpdate: (n) => setV(Math.round(n)) });
    return () => c.stop();
  }, [inView, to]);
  return (
    <span ref={ref}>
      {v.toLocaleString("fr-FR")}
      {suffix}
    </span>
  );
}

const STATS = [
  { to: 2, suffix: "", label: "clubs dans le Var" },
  { to: 3000, suffix: " m²", label: "à Six-Fours" },
  { to: 3, suffix: "", label: "studios, 3 ambiances" },
  { to: 20, suffix: "", label: "cours collectifs différents" },
];

export default function Stats() {
  return (
    <section className="mx-auto grid max-w-7xl grid-cols-2 gap-px overflow-hidden rounded-3xl border border-line bg-line px-0 md:grid-cols-4">
      {STATS.map((s) => (
        <div key={s.label} className="group bg-ink p-6 transition-colors hover:bg-surface sm:p-10">
          <p className="font-display whitespace-nowrap text-4xl text-bone transition-colors group-hover:text-volt sm:text-6xl xl:text-7xl">
            <Counter to={s.to} suffix={s.suffix} />
          </p>
          <p className="mt-3 text-sm text-muted">{s.label}</p>
        </div>
      ))}
    </section>
  );
}
