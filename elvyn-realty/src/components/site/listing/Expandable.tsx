"use client";
import { useEffect, useRef, useState } from "react";

/** Long descriptions are collapsed with a "read more" control (content stays in the HTML for SEO). */
export function Expandable({ children, more, less, maxPx = 420 }: { children: React.ReactNode; more: string; less: string; maxPx?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (ref.current && ref.current.scrollHeight > maxPx + 80) setOverflow(true);
  }, [maxPx]);
  return (
    <div>
      <div ref={ref} id="expandable-content" className="relative overflow-hidden" style={overflow && !open ? { maxHeight: maxPx } : undefined}>
        {children}
        {overflow && !open && <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-white to-transparent" />}
      </div>
      {overflow && (
        <button type="button" className="btn-outline mt-3" aria-expanded={open} aria-controls="expandable-content" onClick={() => setOpen((o) => !o)}>
          {open ? less : more}
        </button>
      )}
    </div>
  );
}
