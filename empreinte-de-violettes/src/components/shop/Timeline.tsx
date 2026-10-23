"use client";

import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { frDateTime } from "@/lib/format";
import type { Order } from "@/lib/types";

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
    return <p className="rounded-2xl bg-rose-950/40 p-5 text-center text-rose-100">Cette commande a été {order.status === "cancelled" ? "annulée" : "remboursée"}.</p>;
  }
  return (
    <div>
      <div className="relative flex justify-between">
        <div className="absolute left-5 right-5 top-5 h-px bg-ivory/15" />
        <motion.div className="bg-foil absolute left-5 top-5 h-px" initial={{ width: 0 }} animate={{ width: current <= 0 ? 0 : `calc(${(current / (steps.length - 1)) * 100}% - ${(current / (steps.length - 1)) * 40}px)` }} transition={{ duration: 1.6, ease: [0.22, 1, 0.36, 1], delay: 0.3 }} />
        {steps.map(([s, label], i) => {
          const done = i <= current;
          const hist = order.history.filter((h) => h.status === s).pop();
          return (
            <div key={s} className="relative z-10 flex w-20 flex-col items-center text-center sm:w-28">
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2 + i * 0.15, type: "spring", stiffness: 200, damping: 14 }}
                className={`flex h-10 w-10 items-center justify-center rounded-full border ${done ? "border-gold bg-gold text-noir" : "border-ivory/20 bg-noir text-ivory/40"} ${i === current ? "ring-4 ring-gold/20" : ""}`}
              >
                {done ? <Check className="h-4 w-4" /> : <span className="text-xs">{i + 1}</span>}
              </motion.span>
              <span className={`mt-3 text-xs ${done ? "text-ivory" : "text-ivory/40"}`}>{label}</span>
              {hist && <span className="mt-1 text-[0.6rem] text-ivory/40">{frDateTime(hist.at)}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
