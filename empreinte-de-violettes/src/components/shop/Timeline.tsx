"use client";

import { motion } from "framer-motion";
import { EASE, roman } from "@/components/herbier/Elements";
import { cn } from "@/lib/cn";
import { frDateTime } from "@/lib/format";
import type { Order } from "@/lib/types";

/** Les étapes de la commande, comme les entrées d'un registre. */
export function Timeline({ order }: { order: Pick<Order, "status" | "mode" | "history"> }) {
  const steps =
    order.mode === "delivery"
      ? [
          ["paid", "Confirmée"],
          ["preparing", "En préparation"],
          ["ready", "Prête"],
          ["out_for_delivery", "En livraison"],
          ["delivered", "Livrée"],
        ]
      : [
          ["paid", "Confirmée"],
          ["preparing", "En préparation"],
          ["ready", "Prête à retirer"],
          ["picked_up", "Retirée"],
        ];
  const idx = steps.findIndex(([s]) => s === order.status);
  const current = order.status === "pending_payment" ? -1 : idx;
  if (order.status === "cancelled" || order.status === "refunded") {
    return <p className="font-display text-[1.6rem] italic">Cette commande a été {order.status === "cancelled" ? "annulée" : "remboursée"}.</p>;
  }
  return (
    <ol className="relative">
      <span className="absolute bottom-3 left-[0.4rem] top-3 w-px bg-ink/15" aria-hidden />
      <motion.span
        className="absolute left-[0.4rem] top-3 w-px origin-top bg-ink"
        style={{ height: `calc(${(Math.max(0, current) / (steps.length - 1)) * 100}% - 1.5rem)` }}
        initial={{ scaleY: 0 }}
        animate={{ scaleY: 1 }}
        transition={{ duration: 1.6, ease: EASE, delay: 0.3 }}
        aria-hidden
      />
      {steps.map(([s, label], i) => {
        const done = i <= current;
        const hist = order.history.filter((h) => h.status === s).pop();
        return (
          <motion.li key={s} className="relative flex items-baseline gap-5 py-3 pl-8" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.7, ease: EASE, delay: 0.2 + i * 0.12 }}>
            <span className={cn("absolute left-0 top-[1.15rem] h-[13px] w-[13px] rounded-full border", done ? "border-ink bg-ink" : "border-ink/30 bg-paper", i === current && "ring-4 ring-ink/10")} aria-hidden />
            <span className="w-8 shrink-0 font-text text-[0.85rem] italic text-ink-muted">{roman(i + 1)}.</span>
            <span className={cn("font-display text-[1.4rem]", done ? "text-ink" : "text-ink-faint", i === current && "italic")}>{label}</span>
            <span className="leader" />
            <span className="shrink-0 font-text text-[0.88rem] italic text-ink-muted">{hist ? frDateTime(hist.at) : done ? "" : "à venir"}</span>
          </motion.li>
        );
      })}
    </ol>
  );
}
