"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState, type ReactNode } from "react";
import type { RequestType } from "@/lib/types";

export type FieldDef = {
  name: string;
  label: string;
  type?: "text" | "email" | "tel" | "date" | "time" | "number" | "select" | "textarea";
  required?: boolean;
  options?: string[];
  placeholder?: string;
  half?: boolean;
  defaultValue?: string;
  min?: string | number;
};

export function RequestForm({
  type,
  fields,
  submitLabel = "Envoyer",
  hidden,
  successTitle = "Merci, c'est envoyé !",
  successText = "Nous revenons vers vous très vite pour confirmer.",
  footer,
}: {
  type: RequestType;
  fields: FieldDef[];
  submitLabel?: string;
  hidden?: Record<string, string>;
  successTitle?: string;
  successText?: string;
  footer?: ReactNode;
}) {
  const [state, setState] = useState<"idle" | "sending" | "ok" | "error">("idle");
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState("sending");
    const fd = new FormData(e.currentTarget);
    const data: Record<string, string> = { ...(hidden ?? {}) };
    fd.forEach((v, k) => (data[k] = String(v)));
    try {
      const res = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, data }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Erreur");
      setState("ok");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
      setState("error");
    }
  }

  return (
    <div className="relative">
      <AnimatePresence mode="wait">
        {state === "ok" ? (
          <motion.div
            key="ok"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center rounded-3xl bg-mint px-6 py-12 text-center"
          >
            <motion.div
              initial={{ scale: 0, rotate: -30 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 14, delay: 0.1 }}
              className="grid h-20 w-20 place-items-center rounded-full bg-sage-deep text-4xl text-white"
            >
              ✓
            </motion.div>
            <h3 className="mt-5 text-3xl">{successTitle}</h3>
            <p className="mt-2 text-ink-soft">{successText}</p>
            <button type="button" className="btn-ghost mt-6" onClick={() => setState("idle")}>
              Nouvelle demande
            </button>
          </motion.div>
        ) : (
          <motion.form key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onSubmit={onSubmit} className="grid grid-cols-2 gap-4">
            {/* anti-spam */}
            <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
            {fields.map((f) => (
              <div key={f.name} className={f.half ? "col-span-2 sm:col-span-1" : "col-span-2"}>
                <label htmlFor={`${type}-${f.name}`} className="label">
                  {f.label}
                  {f.required && <span className="text-tomato"> *</span>}
                </label>
                {f.type === "textarea" ? (
                  <textarea id={`${type}-${f.name}`} name={f.name} required={f.required} placeholder={f.placeholder} rows={4} className="field resize-y" defaultValue={f.defaultValue} />
                ) : f.type === "select" ? (
                  <select id={`${type}-${f.name}`} name={f.name} required={f.required} className="field" defaultValue={f.defaultValue}>
                    {f.options?.map((o) => (
                      <option key={o}>{o}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    id={`${type}-${f.name}`}
                    name={f.name}
                    type={f.type ?? "text"}
                    required={f.required}
                    placeholder={f.placeholder}
                    defaultValue={f.defaultValue}
                    min={f.min}
                    className="field"
                  />
                )}
              </div>
            ))}
            <div className="col-span-2 mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <button type="submit" disabled={state === "sending"} className="btn-primary disabled:opacity-60">
                {state === "sending" ? "Envoi…" : submitLabel}
              </button>
              {footer}
            </div>
            {state === "error" && <p className="col-span-2 rounded-2xl bg-shell px-4 py-3 font-bold text-tomato">Oups : {error}. Vous pouvez aussi nous appeler au 09 56 60 77 74.</p>}
            <p className="col-span-2 text-xs text-ink-soft">
              Vos informations servent uniquement à traiter votre demande. Voir notre <a href="/confidentialite" className="underline">politique de confidentialité</a>.
            </p>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
}
