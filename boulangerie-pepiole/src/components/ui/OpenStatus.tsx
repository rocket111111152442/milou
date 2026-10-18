"use client";

import { useEffect, useState } from "react";
import { describeStatus, getOpenStatus, type OpenStatus as Status } from "@/lib/hours";

export function useOpenStatus() {
  const [status, setStatus] = useState<Status | null>(null);
  useEffect(() => {
    const tick = () => setStatus(getOpenStatus());
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);
  return status;
}

export function OpenStatus({ className = "", tone = "light" }: { className?: string; tone?: "light" | "dark" }) {
  const status = useOpenStatus();
  const base =
    tone === "dark"
      ? "border-creme/20 bg-creme/10 text-creme backdrop-blur-md"
      : "border-cafe/10 bg-creme/80 text-cafe backdrop-blur-md";
  return (
    <span
      className={`inline-flex min-h-8 items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-semibold tracking-wide transition-opacity duration-500 ${base} ${status ? "opacity-100" : "opacity-0"} ${className}`}
      aria-live="polite"
    >
      <span className="relative flex h-2.5 w-2.5">
        {status?.open && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />}
        <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${status?.open ? "bg-emerald-500" : "bg-croute"}`} />
      </span>
      {status ? describeStatus(status) : " "}
    </span>
  );
}
