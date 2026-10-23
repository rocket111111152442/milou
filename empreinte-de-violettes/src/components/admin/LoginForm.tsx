"use client";

import { motion } from "framer-motion";
import { Loader2, Lock } from "lucide-react";
import { useState } from "react";
import { VioletMark } from "@/components/site/Logo";

export function LoginForm({ next, demo }: { next: string; demo: boolean }) {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const r = await fetch("/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
    if (r.ok) window.location.href = next;
    else {
      const d = await r.json().catch(() => ({}));
      setError(d.error || "Erreur");
      setLoading(false);
    }
  }
  return (
    <main className="fern-night relative flex min-h-screen items-center justify-center overflow-hidden bg-noir px-6 text-ivory">
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[70vmin] w-[70vmin] -translate-x-1/2 -translate-y-1/2 rounded-full bg-aubergine-600/30 blur-[120px]" />
      <motion.form
        onSubmit={submit}
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-sm rounded-[2rem] border border-gold/25 bg-aubergine-950/70 p-10 text-center backdrop-blur-xl"
      >
        <motion.div initial={{ rotate: -90, scale: 0.5 }} animate={{ rotate: 0, scale: 1 }} transition={{ type: "spring", stiffness: 120, damping: 12 }}>
          <VioletMark className="mx-auto h-14 w-14 text-gold" />
        </motion.div>
        <p className="eyebrow mt-6 text-gold">Espace fleuriste</p>
        <h1 className="mt-3 font-caps text-lg uppercase tracking-[0.18em]">Empreinte de Violettes</h1>
        <label className="mt-8 block text-left">
          <span className="label text-ivory">Mot de passe</span>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ivory/40" />
            <input type="password" autoFocus required value={password} onChange={(e) => setPassword(e.target.value)} className="field-box pl-11" autoComplete="current-password" />
          </div>
        </label>
        {error && <p className="mt-3 text-sm text-rose-300">{error}</p>}
        <button className="btn btn-gold mt-6 w-full" disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <span>Entrer</span>}
        </button>
        {demo && <p className="mt-6 text-xs text-ivory/45">Démo : mot de passe « violettes » (à changer via ADMIN_PASSWORD).</p>}
        <a href="/" className="mt-4 block text-xs text-ivory/40 hover:text-ivory">
          ← Retour au site
        </a>
      </motion.form>
    </main>
  );
}
