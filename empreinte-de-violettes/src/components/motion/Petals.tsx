"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";

type Petal = { x: number; y: number; s: number; r: number; vr: number; vy: number; sway: number; phase: number; hue: number; alpha: number; flip: number };

const PALETTE = [
  [185, 162, 207],
  [110, 79, 140],
  [233, 215, 168],
  [246, 241, 234],
  [145, 119, 174],
];

/** Pétales de violette qui tombent doucement (canvas, en pause hors écran). */
export function Petals({ count = 22, className, interactive = true }: { count?: number; className?: string; interactive?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = canvas.getContext("2d")!;
    let w = 0;
    let h = 0;
    let raf = 0;
    let visible = true;
    const mouse = { x: -9999, y: -9999 };
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const n = window.innerWidth < 768 ? Math.round(count * 0.55) : count;

    const resize = () => {
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    const make = (top = false): Petal => ({
      x: Math.random() * w,
      y: top ? -30 - Math.random() * h * 0.3 : Math.random() * h,
      s: 6 + Math.random() * 12,
      r: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 0.02,
      vy: 0.25 + Math.random() * 0.55,
      sway: 0.4 + Math.random() * 1.1,
      phase: Math.random() * Math.PI * 2,
      hue: Math.floor(Math.random() * PALETTE.length),
      alpha: 0.25 + Math.random() * 0.45,
      flip: Math.random() * Math.PI * 2,
    });
    const petals = Array.from({ length: n }, () => make());

    const draw = (p: Petal) => {
      const [r, g, b] = PALETTE[p.hue];
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.r);
      ctx.scale(1, Math.abs(Math.cos(p.flip)) * 0.75 + 0.25);
      const grad = ctx.createLinearGradient(0, -p.s, 0, p.s);
      grad.addColorStop(0, `rgba(${r},${g},${b},${p.alpha})`);
      grad.addColorStop(1, `rgba(${r},${g},${b},${p.alpha * 0.25})`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(0, p.s);
      ctx.bezierCurveTo(p.s * 0.9, p.s * 0.4, p.s * 0.75, -p.s * 0.9, 0, -p.s);
      ctx.bezierCurveTo(-p.s * 0.75, -p.s * 0.9, -p.s * 0.9, p.s * 0.4, 0, p.s);
      ctx.fill();
      ctx.strokeStyle = `rgba(${r},${g},${b},${p.alpha * 0.6})`;
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(0, p.s * 0.8);
      ctx.quadraticCurveTo(p.s * 0.1, 0, 0, -p.s * 0.7);
      ctx.stroke();
      ctx.restore();
    };

    let t = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      if (!visible) return;
      t += 1;
      ctx.clearRect(0, 0, w, h);
      for (let i = 0; i < petals.length; i++) {
        const p = petals[i];
        p.y += p.vy;
        p.x += Math.sin(t * 0.012 + p.phase) * p.sway * 0.6;
        p.r += p.vr;
        p.flip += 0.015;
        if (interactive) {
          const dx = p.x - mouse.x;
          const dy = p.y - mouse.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < 140 * 140) {
            const f = (1 - Math.sqrt(d2) / 140) * 2.2;
            p.x += (dx / (Math.sqrt(d2) + 0.1)) * f;
            p.y += (dy / (Math.sqrt(d2) + 0.1)) * f;
            p.vr += 0.002;
          }
        }
        if (p.y > h + 30 || p.x < -40 || p.x > w + 40) petals[i] = make(true);
        draw(p);
      }
    };
    raf = requestAnimationFrame(loop);

    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting), { threshold: 0 });
    io.observe(canvas);
    const onMove = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      mouse.x = e.clientX - r.left;
      mouse.y = e.clientY - r.top;
    };
    const onVis = () => (visible = document.visibilityState === "visible");
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [count, interactive]);

  return <canvas ref={ref} aria-hidden className={cn("pointer-events-none absolute inset-0 h-full w-full", className)} />;
}
