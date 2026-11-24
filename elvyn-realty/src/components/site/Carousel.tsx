"use client";
import { useRef } from "react";

/** Horizontal, swipeable row with arrow buttons (snap scrolling). */
export function Carousel({ children, label, prevLabel, nextLabel }: { children: React.ReactNode; label: string; prevLabel: string; nextLabel: string }) {
  const ref = useRef<HTMLUListElement>(null);
  const move = (dir: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.max(320, el.clientWidth * 0.8), behavior: "smooth" });
  };
  const btn = "inline-flex h-14 w-14 items-center justify-center rounded-full border-2 border-navy text-navy transition-all duration-300 hover:-translate-y-0.5 hover:bg-navy hover:text-white active:scale-95";
  return (
    <div>
      <div className="mb-6 flex justify-end gap-3">
        <button type="button" className={btn} onClick={() => move(-1)} aria-label={prevLabel}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M19 12H5M11 18l-6-6 6-6" /></svg>
        </button>
        <button type="button" className={btn} onClick={() => move(1)} aria-label={nextLabel}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 12h14M13 6l6 6-6 6" /></svg>
        </button>
      </div>
      <ul ref={ref} aria-label={label} className="-mx-4 flex snap-x snap-mandatory gap-6 overflow-x-auto scroll-smooth px-4 pb-6 [scrollbar-width:none] sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 [&::-webkit-scrollbar]:hidden">
        {children}
      </ul>
    </div>
  );
}
