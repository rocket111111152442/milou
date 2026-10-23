"use client";

import { motion, useInView, useMotionValue, useScroll, useSpring, useTransform, type HTMLMotionProps } from "framer-motion";
import { useRef } from "react";
import { cn } from "@/lib/cn";

export const EASE = [0.22, 1, 0.36, 1] as const;

export function Reveal({
  children,
  delay = 0,
  y = 40,
  x = 0,
  blur = false,
  amount = 0.25,
  className,
  duration = 1.1,
  ...rest
}: { delay?: number; y?: number; x?: number; blur?: boolean; amount?: number; duration?: number } & HTMLMotionProps<"div">) {
  return (
    <motion.div
      initial={{ opacity: 0, y, x, filter: blur ? "blur(10px)" : "blur(0px)" }}
      whileInView={{ opacity: 1, y: 0, x: 0, filter: "blur(0px)" }}
      viewport={{ once: true, amount }}
      transition={{ duration, ease: EASE, delay }}
      className={className}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

/** Image dévoilée par un rideau (clip-path) avec léger dézoom. */
export function ImageReveal({
  children,
  className,
  delay = 0,
  direction = "up",
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  direction?: "up" | "left" | "right";
}) {
  // l'observation se fait sur un conteneur non masqué (IntersectionObserver ignore les éléments entièrement clippés)
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.15 });
  const from = direction === "up" ? "inset(100% 0% 0% 0%)" : direction === "left" ? "inset(0% 100% 0% 0%)" : "inset(0% 0% 0% 100%)";
  return (
    <div ref={ref} className={cn("relative", className)}>
      <motion.div
        className="absolute inset-0 overflow-hidden rounded-[inherit]"
        initial={{ clipPath: from }}
        animate={inView ? { clipPath: "inset(0% 0% 0% 0%)" } : { clipPath: from }}
        transition={{ duration: 1.4, ease: [0.77, 0, 0.18, 1], delay }}
      >
        <motion.div
          className="absolute inset-0"
          initial={{ scale: 1.35 }}
          animate={inView ? { scale: 1 } : { scale: 1.35 }}
          transition={{ duration: 2, ease: EASE, delay }}
        >
          {children}
        </motion.div>
      </motion.div>
    </div>
  );
}

/** Décalage vertical lié au défilement. */
export function Parallax({ children, speed = 0.15, className }: { children: React.ReactNode; speed?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [speed * 260, -speed * 260]);
  return (
    <motion.div ref={ref} style={{ y }} className={className}>
      {children}
    </motion.div>
  );
}

/** Effet aimanté au survol. */
export function Magnetic({ children, strength = 0.3, className }: { children: React.ReactNode; strength?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const x = useSpring(0, { stiffness: 180, damping: 15, mass: 0.3 });
  const y = useSpring(0, { stiffness: 180, damping: 15, mass: 0.3 });
  return (
    <motion.div
      ref={ref}
      className={cn("inline-block", className)}
      style={{ x, y }}
      onPointerMove={(e) => {
        if (e.pointerType !== "mouse") return;
        const r = ref.current!.getBoundingClientRect();
        x.set((e.clientX - (r.left + r.width / 2)) * strength);
        y.set((e.clientY - (r.top + r.height / 2)) * strength);
      }}
      onPointerLeave={() => {
        x.set(0);
        y.set(0);
      }}
    >
      {children}
    </motion.div>
  );
}

/** Carte inclinable en 3D avec reflet. */
export function Tilt({ children, className, max = 8 }: { children: React.ReactNode; className?: string; max?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);
  const rx = useSpring(useTransform(py, [0, 1], [max, -max]), { stiffness: 200, damping: 20 });
  const ry = useSpring(useTransform(px, [0, 1], [-max, max]), { stiffness: 200, damping: 20 });
  const glare = useTransform([px, py], ([a, b]: number[]) => `radial-gradient(circle at ${a * 100}% ${b * 100}%, rgba(255,255,255,0.22), transparent 55%)`);
  return (
    <div className="perspective">
      <motion.div
        ref={ref}
        className={cn("preserve-3d relative", className)}
        style={{ rotateX: rx, rotateY: ry }}
        onPointerMove={(e) => {
          if (e.pointerType !== "mouse") return;
          const r = ref.current!.getBoundingClientRect();
          px.set((e.clientX - r.left) / r.width);
          py.set((e.clientY - r.top) / r.height);
        }}
        onPointerLeave={() => {
          px.set(0.5);
          py.set(0.5);
        }}
      >
        {children}
        <motion.div aria-hidden className="pointer-events-none absolute inset-0 z-20 rounded-[inherit] mix-blend-soft-light" style={{ background: glare }} />
      </motion.div>
    </div>
  );
}
