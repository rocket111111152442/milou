"use client";
import * as React from "react";
import { cn } from "@waverti/ui";

export interface SettingsNavItem {
  id: string;
  label: string;
}

/** Sommaire des paramètres : liens d'ancrage + repère de la section visible (liste verticale sur ordinateur, puces défilantes sur téléphone). */
export function SettingsNav({ items }: { items: SettingsNavItem[] }) {
  const [active, setActive] = React.useState(items[0]?.id ?? "");
  React.useEffect(() => {
    const els = items.map((i) => document.getElementById(i.id)).filter((e): e is HTMLElement => Boolean(e));
    if (typeof IntersectionObserver === "undefined" || !els.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActive(visible.target.id);
      },
      { rootMargin: "-96px 0px -60% 0px" },
    );
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, [items]);
  return (
    <nav aria-label="Sections des paramètres" className="min-w-0 lg:sticky lg:top-24 lg:self-start">
      <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2 lg:mx-0 lg:flex-col lg:gap-1 lg:overflow-visible lg:px-0 lg:pb-0">
        {items.map((i) => (
          <li key={i.id} className="shrink-0">
            <a
              href={`#${i.id}`}
              aria-current={active === i.id ? "true" : undefined}
              className={cn(
                "block rounded-full px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-blue lg:rounded-xl",
                active === i.id ? "bg-ink text-white shadow-soft" : "bg-white/70 text-ink-soft hover:bg-white lg:bg-transparent",
              )}
            >
              {i.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
