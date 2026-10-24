"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";

/** Inscription à la lettre des saisons. */
export function Letter({ tone = "light" }: { tone?: "light" | "dark" }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "ok" | "error">("idle");
  const [msg, setMsg] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    const r = await fetch("/api/newsletter", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
    const d = await r.json().catch(() => ({}));
    if (r.ok) setState("ok");
    else {
      setState("error");
      setMsg(d.error || "Une erreur est survenue.");
    }
  }

  const field = tone === "light" ? "f-line-light" : "f-line";
  return (
    <AnimatePresence mode="wait">
      {state === "ok" ? (
        <motion.p key="ok" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-5 font-display text-[1.25rem] italic">
          Merci, à la prochaine saison.
        </motion.p>
      ) : (
        <motion.form key="form" onSubmit={submit} className="mt-4" exit={{ opacity: 0 }}>
          <label htmlFor={`letter-${tone}`} className="sr-only">
            Votre e-mail
          </label>
          <div className="flex items-end gap-3">
            <input id={`letter-${tone}`} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="votre e-mail" className={field} autoComplete="email" />
            <button type="submit" disabled={state === "sending"} className="sc shrink-0 pb-3 disabled:opacity-40">
              {state === "sending" ? "…" : "S'inscrire"}
            </button>
          </div>
          {state === "error" && <p className="mt-2 font-text text-[0.85rem] italic text-[#e9b4b4]">{msg}</p>}
        </motion.form>
      )}
    </AnimatePresence>
  );
}
