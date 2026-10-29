"use client";
import * as React from "react";
import { cn } from "../lib/cn";

type Tone = "success" | "error" | "info";
interface ToastItem {
  id: number;
  tone: Tone;
  title: string;
  description?: string;
}

const ToastContext = React.createContext<{ push: (t: Omit<ToastItem, "id">) => void } | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<ToastItem[]>([]);
  const push = React.useCallback((t: Omit<ToastItem, "id">) => {
    const id = Date.now() + Math.random();
    setItems((prev) => [...prev.slice(-3), { ...t, id }]);
    window.setTimeout(() => setItems((prev) => prev.filter((i) => i.id !== id)), t.tone === "error" ? 8000 : 5000);
  }, []);
  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div
        aria-live="polite"
        aria-relevant="additions"
        className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(380px,calc(100vw-32px))] flex-col gap-2"
      >
        {items.map((t) => (
          <div
            key={t.id}
            role={t.tone === "error" ? "alert" : "status"}
            className={cn(
              "pointer-events-auto flex gap-3 rounded-xl border bg-white p-4 shadow-lift animate-[dialog-in-toast_260ms_var(--ease-out-soft)]",
              t.tone === "error" ? "border-danger/30" : t.tone === "success" ? "border-success/30" : "border-line",
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "mt-1.5 size-2 shrink-0 rounded-full",
                t.tone === "error" ? "bg-danger" : t.tone === "success" ? "bg-success" : "bg-blue",
              )}
            />
            <div className="text-sm">
              <p className="font-medium text-ink">{t.title}</p>
              {t.description ? <p className="mt-0.5 text-muted-fg">{t.description}</p> : null}
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error("useToast doit être utilisé dans <ToastProvider>");
  return ctx;
}
