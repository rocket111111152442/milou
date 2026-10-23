"use client";

import { motion, useAnimationFrame, useMotionValue, useScroll, useSpring, useTransform, useVelocity, wrap } from "framer-motion";
import { useRef } from "react";
import { cn } from "@/lib/cn";

/** Bandeau infini dont la vitesse et l'inclinaison suivent la vitesse de défilement. */
export function Marquee({
  items,
  className,
  itemClassName,
  speed = 2.2,
  separator = "✦",
}: {
  items: string[];
  className?: string;
  itemClassName?: string;
  speed?: number;
  separator?: string;
}) {
  const baseX = useMotionValue(0);
  const { scrollY } = useScroll();
  const velocity = useVelocity(scrollY);
  const smooth = useSpring(velocity, { damping: 50, stiffness: 300 });
  const factor = useTransform(smooth, [0, 1000], [0, 4], { clamp: false });
  const skew = useTransform(smooth, [-2000, 0, 2000], [8, 0, -8]);
  const dir = useRef(1);
  const x = useTransform(baseX, (v) => `${wrap(-25, 0, v)}%`);

  useAnimationFrame((_, delta) => {
    let move = dir.current * -speed * (delta / 1000);
    const f = factor.get();
    if (f < 0) dir.current = -1;
    else if (f > 0) dir.current = 1;
    move += dir.current * -Math.abs(f) * speed * (delta / 1000);
    baseX.set(baseX.get() + move);
  });

  const row = (
    <div className="flex shrink-0 items-center">
      {items.map((t, i) => (
        <span key={i} className={cn("flex items-center whitespace-nowrap", itemClassName)}>
          {t}
          <span className="mx-[0.6em] inline-block text-[0.45em] text-gold">{separator}</span>
        </span>
      ))}
    </div>
  );

  return (
    <div className={cn("overflow-hidden", className)}>
      <motion.div className="flex w-max" style={{ x, skewX: skew }}>
        {row}
        {row}
        {row}
        {row}
      </motion.div>
    </div>
  );
}
