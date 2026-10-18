"use client";

import {
  motion,
  useAnimationFrame,
  useMotionValue,
  useScroll,
  useSpring,
  useTransform,
  useVelocity,
  wrap,
} from "motion/react";
import { useRef } from "react";

/** Bandeau défilant dont la vitesse réagit au scroll. */
function Row({ items, baseVelocity, className }: { items: string[]; baseVelocity: number; className?: string }) {
  const x = useMotionValue(0);
  const { scrollY } = useScroll();
  const velocity = useVelocity(scrollY);
  const smooth = useSpring(velocity, { damping: 50, stiffness: 400 });
  const factor = useTransform(smooth, [-1000, 0, 1000], [-4, 0, 4], { clamp: false });
  const skew = useTransform(smooth, [-2000, 0, 2000], [8, 0, -8]);
  const dir = useRef(1);

  useAnimationFrame((_, delta) => {
    let move = dir.current * baseVelocity * (delta / 1000);
    const f = factor.get();
    if (f < 0) dir.current = -1;
    else if (f > 0) dir.current = 1;
    move += dir.current * move * f;
    x.set(wrap(-50, 0, x.get() + move));
  });

  const translate = useTransform(x, (v) => `${v}%`);
  const content = [...items, ...items];

  return (
    <div className="flex overflow-hidden whitespace-nowrap">
      <motion.div className={`flex shrink-0 items-center ${className}`} style={{ x: translate, skewX: skew }}>
        {[0, 1].map((k) => (
          <div key={k} className="flex shrink-0 items-center" aria-hidden={k === 1}>
            {content.map((item, i) => (
              <span key={`${k}-${i}`} className="flex items-center">
                <span className="px-6">{item}</span>
                <svg viewBox="0 0 24 24" className="h-[0.45em] w-[0.45em] text-caramel" aria-hidden="true">
                  <path d="M12 0 L14.5 9.5 L24 12 L14.5 14.5 L12 24 L9.5 14.5 L0 12 L9.5 9.5 Z" fill="currentColor" />
                </svg>
              </span>
            ))}
          </div>
        ))}
      </motion.div>
    </div>
  );
}

export function Marquee() {
  return (
    <section aria-label="Nos spécialités" className="relative overflow-hidden bg-farine py-10 sm:py-14">
      <div className="-rotate-2 bg-cafe py-4 text-creme shadow-xl">
        <Row
          baseVelocity={-2}
          className="font-display text-3xl italic sm:text-5xl"
          items={["Baguette de tradition", "Pain au levain", "Viennoiseries", "Tartes de saison", "Entremets maison", "Pause café"]}
        />
      </div>
      <div className="mt-[-6px] rotate-1 bg-dore py-3 text-torref">
        <Row
          baseVelocity={1.5}
          className="text-sm font-extrabold uppercase tracking-[0.3em] sm:text-base"
          items={["Pétri sur place", "Façonné à la main", "Cuit chaque jour", "Ouvert 7j/7", "Parking", "Sanary-sur-Mer"]}
        />
      </div>
    </section>
  );
}
