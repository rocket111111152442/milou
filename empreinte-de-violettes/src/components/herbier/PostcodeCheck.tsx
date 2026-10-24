"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { euro } from "@/lib/format";
import { EASE } from "./Elements";

type Result = { ok: boolean; message?: string; zone?: { name: string; fee: number; minOrder: number; freeFrom: number | null; cities: string[] } };

/** « Livrez-vous chez moi ? » — vérification du code postal. */
export function PostcodeCheck({ cutoff }: { cutoff: string }) {
  const [pc, setPc] = useState("");
  const [loading, setLoading] = useState(false);
  const [res, setRes] = useState<Result | null>(null);

  async function check(e: React.FormEvent) {
    e.preventDefault();
    if (pc.length !== 5) return;
    setLoading(true);
    const r = await fetch("/api/delivery/check", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ postcode: pc }) });
    setRes(await r.json().catch(() => ({ ok: false, message: "Vérification impossible pour le moment." })));
    setLoading(false);
  }

  return (
    <div>
      <form onSubmit={check} className="flex items-end gap-4">
        <label className="min-w-0 flex-1">
          <span className="f-label">Votre code postal</span>
          <input
            inputMode="numeric"
            maxLength={5}
            value={pc}
            onChange={(e) => {
              setPc(e.target.value.replace(/\D/g, ""));
              setRes(null);
            }}
            placeholder="83140"
            className="f-line tab !text-[1.6rem] font-display"
            aria-describedby="pc-result"
          />
        </label>
        <button type="submit" disabled={pc.length !== 5 || loading} className="btn-line pb-3 disabled:opacity-35">
          {loading ? "…" : "Vérifier"} <span className="arrow">→</span>
        </button>
      </form>
      <div id="pc-result" aria-live="polite" className="min-h-[4.5rem]">
        <AnimatePresence mode="wait">
          {res && (
            <motion.p key={JSON.stringify(res)} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.6, ease: EASE }} className="mt-4 font-text text-[1.05rem] leading-relaxed">
              {res.ok && res.zone ? (
                <>
                  <span className="font-display text-[1.3rem] italic">Oui, nous livrons {res.zone.name}.</span>
                  <br />
                  <span className="text-ink-soft">
                    Livraison {euro(res.zone.fee, { compact: true })}
                    {res.zone.freeFrom != null && <>, offerte dès {euro(res.zone.freeFrom, { compact: true })}</>} · commande minimum {euro(res.zone.minOrder, { compact: true })} · le jour même pour toute commande passée avant {cutoff}.
                  </span>
                </>
              ) : (
                <span className="italic text-ink-soft">{res.message}</span>
              )}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
