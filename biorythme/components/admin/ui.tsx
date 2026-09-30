"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect } from "react";

export function Drawer({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[70]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-ink/70 backdrop-blur-sm" onClick={onClose} />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 280, damping: 32 }}
            className="absolute inset-y-0 right-0 w-full max-w-lg overflow-y-auto border-l border-line bg-surface p-6"
          >
            <div className="mb-6 flex items-center justify-between gap-4">
              <h2 className="font-display text-4xl">{title}</h2>
              <button onClick={onClose} className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-line" aria-label="Fermer">
                ✕
              </button>
            </div>
            {children}
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Label({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs uppercase tracking-[0.15em] text-muted">{text}</span>
      {children}
    </label>
  );
}

export const inputCls =
  "w-full rounded-xl border border-line bg-ink px-3 py-2.5 text-sm outline-none transition focus:border-volt";

export function Btn({
  children,
  variant = "primary",
  className = "",
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "danger" }) {
  const styles = {
    primary: "bg-volt text-ink hover:brightness-110",
    ghost: "border border-line text-bone hover:border-bone/40",
    danger: "border border-blaze/40 text-blaze hover:bg-blaze/10",
  }[variant];
  return (
    <button
      className={`rounded-full px-4 py-2.5 text-sm font-semibold transition active:scale-[0.97] disabled:opacity-50 ${styles} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Toast({ message, tone }: { message: string | null; tone: "ok" | "error" }) {
  return (
    <AnimatePresence>
      {message && (
        <motion.div
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 40, opacity: 0 }}
          className={`fixed bottom-6 left-1/2 z-[80] -translate-x-1/2 rounded-full px-5 py-3 text-sm font-semibold shadow-2xl ${
            tone === "ok" ? "bg-volt text-ink" : "bg-blaze text-ink"
          }`}
        >
          {message}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
