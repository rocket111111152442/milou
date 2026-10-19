"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { describeStatus, getOpenStatus, type OpenStatus as Status } from "@/lib/hours";
import type { Shop } from "@/lib/shops";
import { useSiteData } from "@/components/SettingsProvider";

/** Statut d'ouverture de chaque boutique, recalculé toutes les 30 s (côté client uniquement). */
export function useOpenStatuses() {
  const { shops: SHOPS } = useSiteData();
  const [statuses, setStatuses] = useState<Record<string, Status> | null>(null);
  useEffect(() => {
    const tick = () => setStatuses(Object.fromEntries(SHOPS.map((s) => [s.id, getOpenStatus(s)])));
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [SHOPS]);
  return statuses;
}

function pillClass(tone: "light" | "dark") {
  return tone === "dark"
    ? "border-creme/20 bg-creme/10 text-creme backdrop-blur-md"
    : "border-cafe/10 bg-creme/80 text-cafe backdrop-blur-md";
}

function Dot({ open }: { open?: boolean }) {
  return (
    <span className="relative flex h-2.5 w-2.5 shrink-0">
      {open && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />}
      <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${open ? "bg-emerald-500" : "bg-croute"}`} />
    </span>
  );
}

/** Statut d'une boutique. */
export function OpenStatus({
  shop,
  className = "",
  tone = "light",
  showName = false,
}: {
  shop: Shop;
  className?: string;
  tone?: "light" | "dark";
  showName?: boolean;
}) {
  const statuses = useOpenStatuses();
  const status = statuses?.[shop.id];
  return (
    <span
      className={`inline-flex min-h-8 items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-semibold tracking-wide transition-opacity duration-500 ${pillClass(tone)} ${status ? "opacity-100" : "opacity-0"} ${className}`}
      aria-live="polite"
    >
      <Dot open={status?.open} />
      {status ? `${showName ? `${shop.short} · ` : ""}${describeStatus(status)}` : " "}
    </span>
  );
}

/** Statut des boutiques, qui défile de l'une à l'autre. */
export function OpenStatusCycle({ className = "", tone = "light" }: { className?: string; tone?: "light" | "dark" }) {
  const statuses = useOpenStatuses();
  const { shops: SHOPS } = useSiteData();
  const [i, setI] = useState(0);
  useEffect(() => {
    if (SHOPS.length < 2) return;
    const id = setInterval(() => setI((n) => (n + 1) % SHOPS.length), 3800);
    return () => clearInterval(id);
  }, [SHOPS.length]);
  const shop = SHOPS[i];
  const status = statuses?.[shop.id];
  return (
    <span
      className={`inline-flex min-h-8 items-center gap-2 overflow-hidden rounded-full border px-3.5 py-1.5 text-xs font-semibold tracking-wide transition-opacity duration-500 ${pillClass(tone)} ${status ? "opacity-100" : "opacity-0"} ${className}`}
      aria-live="off"
      title={statuses ? SHOPS.map((s) => `${s.short} : ${describeStatus(statuses[s.id])}`).join(" — ") : undefined}
    >
      <Dot open={status?.open} />
      <span className="relative grid">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={shop.id}
            initial={{ y: 14, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -14, opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="whitespace-nowrap"
          >
            {status ? `${shop.short} · ${describeStatus(status)}` : " "}
          </motion.span>
        </AnimatePresence>
      </span>
    </span>
  );
}
