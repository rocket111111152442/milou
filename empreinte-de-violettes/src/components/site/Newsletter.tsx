"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Check } from "lucide-react";
import { useState } from "react";

export function Newsletter({ dark = true }: { dark?: boolean }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [msg, setMsg] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("loading");
    const res = await fetch("/api/newsletter", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setState("ok");
      setEmail("");
    } else {
      setState("error");
      setMsg(data.error || "Une erreur est survenue.");
    }
  }

  return (
    <form onSubmit={submit} className="mt-7 max-w-sm">
      <div className={`relative flex items-center border-b ${dark ? "border-ivory/25 focus-within:border-gold" : "border-noir/25 focus-within:border-aubergine-600"} transition-colors`}>
        <label htmlFor="nl-email" className="sr-only">
          Votre adresse e-mail
        </label>
        <input
          id="nl-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Votre adresse e-mail"
          className="w-full bg-transparent py-3 pr-12 text-sm outline-none placeholder:opacity-50"
        />
        <button type="submit" disabled={state === "loading"} className="absolute right-0 rounded-full p-2 transition hover:translate-x-1" aria-label="S'inscrire">
          <AnimatePresence mode="wait">
            {state === "ok" ? (
              <motion.span key="ok" initial={{ scale: 0 }} animate={{ scale: 1 }}>
                <Check className="h-4 w-4 text-gold" />
              </motion.span>
            ) : (
              <motion.span key="go" initial={{ scale: 0 }} animate={{ scale: 1 }}>
                <ArrowRight className="h-4 w-4" />
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </div>
      <p className="mt-2 h-4 text-xs" aria-live="polite">
        {state === "ok" && <span className="text-gold-light">Merci ! À très vite dans votre boîte aux lettres.</span>}
        {state === "error" && <span className="text-rose-300">{msg}</span>}
      </p>
    </form>
  );
}
