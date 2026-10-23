"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Check, Loader2, MapPin, X } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { euro } from "@/lib/format";

type Result = { ok: boolean; message?: string; zone?: { name: string; fee: number; minOrder: number; freeFrom: number | null; cities: string[] } };

export function DeliveryChecker({ tone = "dark" }: { tone?: "dark" | "light" }) {
  const [pc, setPc] = useState("");
  const [loading, setLoading] = useState(false);
  const [res, setRes] = useState<Result | null>(null);

  async function check(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const r = await fetch("/api/delivery/check", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ postcode: pc }) });
    setRes(await r.json());
    setLoading(false);
  }

  const light = tone === "light";
  return (
    <div>
      <form onSubmit={check} className={cn("flex items-center gap-2 rounded-full border p-1.5 pl-5 transition", light ? "border-noir/15 bg-white/70 focus-within:border-aubergine-500" : "border-ivory/15 bg-ivory/[0.04] focus-within:border-gold/60")}>
        <MapPin className={cn("h-4 w-4 shrink-0", light ? "text-aubergine-600" : "text-gold")} strokeWidth={1.4} />
        <label htmlFor="dc-pc" className="sr-only">
          Code postal
        </label>
        <input
          id="dc-pc"
          inputMode="numeric"
          maxLength={5}
          value={pc}
          onChange={(e) => {
            setPc(e.target.value.replace(/\D/g, ""));
            setRes(null);
          }}
          placeholder="Votre code postal"
          className="w-full bg-transparent text-sm outline-none placeholder:opacity-50"
        />
        <button type="submit" disabled={pc.length !== 5 || loading} className={cn("btn !px-5 !py-2.5", light ? "btn-noir" : "btn-ivory")}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <span>Vérifier</span>}
        </button>
      </form>
      <AnimatePresence mode="wait">
        {res && (
          <motion.div
            key={JSON.stringify(res)}
            initial={{ opacity: 0, y: -8, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -8, height: 0 }}
            className="overflow-hidden"
          >
            <div className={cn("mt-4 flex gap-3 rounded-2xl p-4 text-sm", res.ok ? (light ? "bg-aubergine-100 text-aubergine-900" : "bg-aubergine-800/60 text-ivory") : light ? "bg-rose-50 text-rose-900" : "bg-rose-950/40 text-rose-100")}>
              {res.ok ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-gold" /> : <X className="mt-0.5 h-4 w-4 shrink-0" />}
              {res.ok && res.zone ? (
                <p>
                  Bonne nouvelle, nous livrons <strong>{res.zone.name}</strong> : {euro(res.zone.fee)} de frais
                  {res.zone.freeFrom != null && <> (offerts dès {euro(res.zone.freeFrom, { compact: true })})</>}, minimum {euro(res.zone.minOrder, { compact: true })}.{" "}
                  <a href="/boutique" className="inline-flex items-center gap-1 underline underline-offset-4">
                    Choisir mon bouquet <ArrowRight className="h-3 w-3" />
                  </a>
                </p>
              ) : (
                <p>{res.message}</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
