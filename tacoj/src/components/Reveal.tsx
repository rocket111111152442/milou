"use client";
import { useEffect, useRef } from "react";

/** Fades content in once when it scrolls into view. Respects reduced-motion via CSS. */
export default function Reveal({ children, className = "", delay = 0, as: Tag = "div" }: {
  children: React.ReactNode; className?: string; delay?: number; as?: "div" | "li" | "article";
}) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!("IntersectionObserver" in window)) { el.classList.add("is-visible"); return; }
    const io = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { el.classList.add("is-visible"); io.disconnect(); } },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <Tag ref={ref as any} className={`reveal ${className}`} style={delay ? { transitionDelay: `${delay}ms` } : undefined}>
      {children}
    </Tag>
  );
}
