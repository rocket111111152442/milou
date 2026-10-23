"use client";

import { Loader2 } from "lucide-react";
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
    const d = await r.json();
    setLoading(false);
    if (d.ok) router.push(d.url);
    else setMsg(d.message);
  }
  return (
    <form onSubmit={submit} className="mx-auto mt-10 grid max-w-xl gap-4 rounded-[2rem] border border-ivory/10 bg-ivory/[0.03] p-8">
      <label>
        <span className="label text-ivory">Numéro de commande</span>
        <input required value={number} onChange={(e) => setNumber(e.target.value.toUpperCase())} placeholder="EV-261023-XXX" className="field-box" />
      </label>
      <label>
        <span className="label text-ivory">E-mail utilisé pour la commande</span>
        <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="field-box" />
      </label>
      {msg && <p className="text-sm text-rose-300">{msg}</p>}
      <button className="btn btn-gold mt-2" disabled={loading}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <span>Suivre ma commande</span>}
      </button>
    </form>
  );
}
