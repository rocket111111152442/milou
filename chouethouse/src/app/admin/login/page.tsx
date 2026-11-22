"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { useState } from "react";
import { Owl } from "@/components/decor";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const password = new FormData(e.currentTarget).get("password");
    const res = await fetch("/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
    setLoading(false);
    if (res.ok) router.replace("/admin");
    else setError((await res.json().catch(() => ({}))).error || "Erreur");
  }

  return (
    <div className="grid min-h-screen place-items-center bg-shell p-5">
      <motion.form
        onSubmit={submit}
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="card w-full max-w-sm p-8 text-center"
      >
        <Owl className="mx-auto h-20 w-20 animate-float" />
        <Image src="/images/logo-horizontal.webp" alt="Chouet'House" width={200} height={46} className="mx-auto mt-4 h-10 w-auto" />
        <h1 className="mt-4 text-2xl">Espace admin</h1>
        <label htmlFor="pwd" className="label mt-6 text-left">Mot de passe</label>
        <input id="pwd" name="password" type="password" required autoFocus className="field" autoComplete="current-password" />
        {error && <p className="mt-3 font-bold text-tomato">{error}</p>}
        <button disabled={loading} className="btn-primary mt-6 w-full disabled:opacity-60">{loading ? "Connexion…" : "Se connecter"}</button>
      </motion.form>
    </div>
  );
}
