"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Check, Loader2 } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";
import type { MessageType } from "@/lib/types";

const TYPES: { id: MessageType; label: string }[] = [
  { id: "contact", label: "Question" },
  { id: "mariage", label: "Mariage" },
  { id: "evenement", label: "Événement" },
  { id: "deuil", label: "Deuil" },
  { id: "entreprise", label: "Entreprise" },
];

export function ContactForm({ defaultType = "contact", tone = "dark", lockType = false }: { defaultType?: MessageType; tone?: "dark" | "light"; lockType?: boolean }) {
  const [type, setType] = useState<MessageType>(defaultType);
  const [form, setForm] = useState({ name: "", email: "", phone: "", subject: "", message: "", eventDate: "", venue: "", guests: "", budget: "", website: "" });
  const [state, setState] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [err, setErr] = useState("");
  const light = tone === "light";
  const box = light ? "field-box-light" : "field-box";
  const lbl = cn("label", light ? "text-noir" : "text-ivory");
  const isEvent = type === "mariage" || type === "evenement";
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm({ ...form, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("loading");
    const payload = Object.fromEntries(Object.entries({ ...form, type }).filter(([, v]) => v !== ""));
    const r = await fetch("/api/contact", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const d = await r.json().catch(() => ({}));
    if (r.ok) setState("ok");
    else {
      setState("error");
      setErr(d.error || "Une erreur est survenue.");
    }
  }

  return (
    <AnimatePresence mode="wait">
      {state === "ok" ? (
        <motion.div key="ok" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className={cn("flex flex-col items-center rounded-[2rem] p-12 text-center", light ? "bg-white/70" : "bg-ivory/[0.04]")}>
          <motion.span initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 160, damping: 12 }} className="bg-foil flex h-16 w-16 items-center justify-center rounded-full text-noir">
            <Check className="h-7 w-7" />
          </motion.span>
          <p className="mt-6 font-display text-4xl italic">Message bien reçu</p>
          <p className={cn("mt-3 max-w-sm", light ? "text-noir/60" : "text-ivory/60")}>Merci ! Nous vous répondons sous 24 h (hors dimanche après-midi et lundi).</p>
        </motion.div>
      ) : (
        <motion.form key="form" onSubmit={submit} className="space-y-5" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          {!lockType && (
            <div className="flex flex-wrap gap-2">
              {TYPES.map((t) => (
                <button
                  type="button"
                  key={t.id}
                  onClick={() => setType(t.id)}
                  className={cn(
                    "relative rounded-full px-4 py-2 text-xs uppercase tracking-[0.16em] transition",
                    type === t.id ? (light ? "text-ivory" : "text-noir") : light ? "border border-noir/15 text-noir/60" : "border border-ivory/15 text-ivory/60",
                  )}
                >
                  {type === t.id && <motion.span layoutId="ct-type" className={cn("absolute inset-0 rounded-full", light ? "bg-aubergine-700" : "bg-ivory")} />}
                  <span className="relative">{t.label}</span>
                </button>
              ))}
            </div>
          )}
          <div className="grid gap-5 sm:grid-cols-2">
            <label>
              <span className={lbl}>Nom *</span>
              <input required className={box} value={form.name} onChange={set("name")} autoComplete="name" />
            </label>
            <label>
              <span className={lbl}>E-mail *</span>
              <input required type="email" className={box} value={form.email} onChange={set("email")} autoComplete="email" />
            </label>
            <label>
              <span className={lbl}>Téléphone</span>
              <input type="tel" className={box} value={form.phone} onChange={set("phone")} autoComplete="tel" />
            </label>
            {isEvent ? (
              <label>
                <span className={lbl}>Date de l&apos;événement</span>
                <input type="date" className={box} value={form.eventDate} onChange={set("eventDate")} />
              </label>
            ) : (
              <label>
                <span className={lbl}>Objet</span>
                <input className={box} value={form.subject} onChange={set("subject")} />
              </label>
            )}
            <AnimatePresence>
              {isEvent && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="grid gap-5 overflow-hidden sm:col-span-2 sm:grid-cols-3">
                  <label>
                    <span className={lbl}>Lieu</span>
                    <input className={box} value={form.venue} onChange={set("venue")} placeholder="Domaine, église…" />
                  </label>
                  <label>
                    <span className={lbl}>Invités</span>
                    <input className={box} value={form.guests} onChange={set("guests")} placeholder="ex. 120" />
                  </label>
                  <label>
                    <span className={lbl}>Budget fleurs</span>
                    <select className={box} value={form.budget} onChange={set("budget")}>
                      <option value="">À définir</option>
                      <option>Moins de 500 €</option>
                      <option>500 – 1 500 €</option>
                      <option>1 500 – 3 000 €</option>
                      <option>Plus de 3 000 €</option>
                    </select>
                  </label>
                </motion.div>
              )}
            </AnimatePresence>
            <label className="sm:col-span-2">
              <span className={lbl}>Votre message *</span>
              <textarea required rows={5} className={cn(box, "resize-none")} value={form.message} onChange={set("message")} placeholder={isEvent ? "Votre palette, votre style, vos envies…" : "Comment pouvons-nous vous aider ?"} />
            </label>
            <input tabIndex={-1} autoComplete="off" className="hidden" value={form.website} onChange={set("website")} aria-hidden />
          </div>
          {state === "error" && <p className="text-sm text-rose-400">{err}</p>}
          <button type="submit" disabled={state === "loading"} className={cn("btn", light ? "btn-noir" : "btn-gold")}>
            {state === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <span>{isEvent ? "Demander un devis" : "Envoyer"}</span>}
            <ArrowRight className="h-4 w-4" />
          </button>
          <p className={cn("text-xs", light ? "text-noir/45" : "text-ivory/40")}>Vos données servent uniquement à vous répondre et sont conservées 3 ans.</p>
        </motion.form>
      )}
    </AnimatePresence>
  );
}
