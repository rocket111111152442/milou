"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { cn } from "@/lib/cn";
import type { MessageType } from "@/lib/types";
import { EASE } from "./Elements";
import { Plate } from "./Plate";

const TYPES: { id: MessageType; label: string }[] = [
  { id: "contact", label: "Une question" },
  { id: "mariage", label: "Un mariage" },
  { id: "evenement", label: "Un événement" },
  { id: "deuil", label: "Un hommage" },
  { id: "entreprise", label: "Une entreprise" },
];

/** Formulaire de contact : une lettre à la fleuriste. */
export function ContactForm({ defaultType = "contact", lockType = false }: { defaultType?: MessageType; lockType?: boolean }) {
  const [type, setType] = useState<MessageType>(defaultType);
  const [f, setF] = useState({ name: "", email: "", phone: "", subject: "", message: "", eventDate: "", venue: "", guests: "", budget: "", website: "" });
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState("");
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  const isEvent = type === "mariage" || type === "evenement";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setState("sending");
    const body: Record<string, string> = { type, name: f.name, email: f.email, message: f.message };
    if (f.phone) body.phone = f.phone;
    if (f.subject) body.subject = f.subject;
    if (f.website) body.website = f.website;
    if (isEvent) for (const k of ["eventDate", "venue", "guests", "budget"] as const) if (f[k]) body[k] = f[k];
    const r = await fetch("/api/contact", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await r.json().catch(() => ({}));
    if (r.ok) setState("sent");
    else {
      setState("idle");
      setError(d.error || "L'envoi a échoué. Réessayez, ou appelez-nous.");
    }
  }

  return (
    <div className="sheet relative p-6 sm:p-10">
      <AnimatePresence mode="wait">
        {state === "sent" ? (
          <motion.div key="sent" className="flex min-h-[420px] flex-col items-center justify-center text-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8 }}>
            <Plate name="violette" reveal="mount" duration={1.8} className="w-40 text-plum" />
            <p className="mt-8 font-display text-[2.2rem] italic leading-tight">Votre lettre est partie.</p>
            <p className="body-text mt-3 max-w-sm">Nous vous répondons au plus vite, en général sous 48 heures.</p>
          </motion.div>
        ) : (
          <motion.form key="form" onSubmit={submit} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.4, ease: EASE }}>
            {!lockType && (
              <fieldset className="min-w-0">
                <legend className="f-label">Vous nous écrivez pour</legend>
                <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2">
                  {TYPES.map((t) => (
                    <label key={t.id} className={cn("cursor-pointer font-display text-[1.25rem] transition-colors", type === t.id ? "italic text-ink" : "text-ink-muted hover:text-ink")}>
                      <input type="radio" name="type" className="sr-only" checked={type === t.id} onChange={() => setType(t.id)} />
                      <span className={type === t.id ? "ulink-on" : "ulink"}>{t.label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
            <div className={cn("grid gap-x-8 gap-y-6 sm:grid-cols-2", !lockType && "mt-8")}>
              <label>
                <span className="f-label">Votre nom *</span>
                <input required minLength={2} className="f-line" value={f.name} onChange={set("name")} autoComplete="name" />
              </label>
              <label>
                <span className="f-label">E-mail *</span>
                <input required type="email" className="f-line" value={f.email} onChange={set("email")} autoComplete="email" />
              </label>
              <label>
                <span className="f-label">Téléphone</span>
                <input type="tel" className="f-line tab" value={f.phone} onChange={set("phone")} autoComplete="tel" />
              </label>
              <label>
                <span className="f-label">{isEvent ? "Date de l'événement" : "Objet"}</span>
                {isEvent ? <input type="date" className="f-line" value={f.eventDate} onChange={set("eventDate")} /> : <input className="f-line" value={f.subject} onChange={set("subject")} />}
              </label>
              <AnimatePresence initial={false}>
                {isEvent && (
                  <motion.div key="event" className="grid gap-x-8 gap-y-6 overflow-hidden sm:col-span-2 sm:grid-cols-3" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.5, ease: EASE }}>
                    <label>
                      <span className="f-label">Lieu</span>
                      <input className="f-line" value={f.venue} onChange={set("venue")} placeholder="domaine, église…" />
                    </label>
                    <label>
                      <span className="f-label">Invités</span>
                      <input className="f-line tab" value={f.guests} onChange={set("guests")} placeholder="environ 80" />
                    </label>
                    <label>
                      <span className="f-label">Budget fleurs</span>
                      <input className="f-line tab" value={f.budget} onChange={set("budget")} placeholder="à titre indicatif" />
                    </label>
                  </motion.div>
                )}
              </AnimatePresence>
              <label className="sm:col-span-2">
                <span className="f-label">Votre message *</span>
                <textarea required minLength={5} rows={5} className="f-line resize-none" value={f.message} onChange={set("message")} placeholder={isEvent ? "Vos envies, vos couleurs, ce qui compte pour vous…" : "Écrivez-nous…"} />
              </label>
              <input type="text" tabIndex={-1} autoComplete="off" value={f.website} onChange={set("website")} className="hidden" aria-hidden />
            </div>
            {error && (
              <p className="mt-5 font-text italic text-[#7d2d2d]" role="alert">
                {error}
              </p>
            )}
            <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
              <p className="font-text text-[0.85rem] italic text-ink-muted">Vos coordonnées ne servent qu&apos;à vous répondre.</p>
              <button type="submit" disabled={state === "sending"} className="btn-label">
                <span>{state === "sending" ? "Envoi…" : "Envoyer"}</span>
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
}
