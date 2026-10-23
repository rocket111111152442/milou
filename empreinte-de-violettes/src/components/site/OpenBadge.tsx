"use client";

import { useEffect, useState } from "react";
import { openState } from "@/lib/delivery";
import type { Settings } from "@/lib/types";

export function OpenBadge({ settings, className = "" }: { settings: Settings; className?: string }) {
  const [state, setState] = useState<{ open: boolean; label: string } | null>(null);
  useEffect(() => {
    const update = () => setState(openState(settings));
    update();
    const id = setInterval(update, 60_000);
    return () => clearInterval(id);
  }, [settings]);
  if (!state) return <span className={`inline-block h-7 ${className}`} />;
  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs ${state.open ? "border-emerald-400/30 text-emerald-300" : "border-ivory/15 text-ivory/60"} ${className}`}>
      <span className="relative flex h-2 w-2">
        {state.open && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />}
        <span className={`relative inline-flex h-2 w-2 rounded-full ${state.open ? "bg-emerald-400" : "bg-ivory/40"}`} />
      </span>
      {state.label}
    </span>
  );
}
