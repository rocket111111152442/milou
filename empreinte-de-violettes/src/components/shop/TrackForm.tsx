"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function TrackForm() {
  const router = useRouter();
  const [number, setNumber] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg("");
    const r = await fetch("/api/orders/track", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ number, email }) });
    const d = await r.json().catch(() => ({ message: "Une erreur est survenue." }));
    setLoading(false);
    if (d.ok) router.push(d.url);
    else setMsg(d.message);
  }
  return (
    <form onSubmit={submit} className="sheet mx-auto grid max-w-xl gap-7 p-8 sm:p-10">
      <label>
        <span className="f-label">Numéro de commande</span>
        <input required value={number} onChange={(e) => setNumber(e.target.value.toUpperCase())} placeholder="EV-261023-XXX" className="f-line tab tracking-[0.06em]" />
      </label>
      <label>
        <span className="f-label">E-mail utilisé pour la commande</span>
        <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="f-line" autoComplete="email" />
      </label>
      {msg && <p className="font-text italic text-[#7d2d2d]">{msg}</p>}
      <button className="btn-label mt-2" disabled={loading}>
        <span>{loading ? "Recherche…" : "Suivre ma commande"}</span>
      </button>
    </form>
  );
}
