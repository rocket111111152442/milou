"use client";

import { AnimatePresence, motion } from "motion/react";
import { useCallback, useRef, useState } from "react";

export function useToast() {
  const [msg, setMsg] = useState<{ text: string; kind: "ok" | "error" } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = useCallback((text: string, kind: "ok" | "error" = "ok") => {
    setMsg({ text, kind });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMsg(null), 2800);
  }, []);
  return { msg, show };
}

export function Toast({ msg }: { msg: { text: string; kind: "ok" | "error" } | null }) {
  return (
    <AnimatePresence>
      {msg && (
        <motion.div
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 40, opacity: 0 }}
          className="pointer-events-none fixed inset-x-0 bottom-6 z-[100] flex justify-center"
        >
          <span className={`rounded-full px-6 py-3 font-bold text-white shadow-xl ${msg.kind === "error" ? "bg-tomato" : "bg-sage-deep"}`}>{msg.text}</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
