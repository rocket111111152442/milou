"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { cancelBooking } from "@/app/actions";
import { fmtDayLong, fmtTime } from "@/lib/format";
import { writeMyBookings, type MyBooking } from "./myBookings";

export default function MyBookingsPanel({
  bookings,
  onChange,
}: {
  bookings: MyBooking[];
  onChange: (list: MyBooking[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  async function cancel(b: MyBooking) {
    if (!confirm(`Annuler votre place au cours ${b.course} ?`)) return;
    setBusy(b.token);
    await cancelBooking(b.token);
    const next = bookings.filter((x) => x.token !== b.token);
    writeMyBookings(next);
    onChange(next);
    setBusy(null);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="relative rounded-full border border-line px-4 py-2 text-sm font-medium hover:border-bone/40"
      >
        Mes réservations
        {bookings.length > 0 && (
          <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-volt px-1 text-[11px] font-bold text-ink">
            {bookings.length}
          </span>
        )}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div className="fixed inset-0 z-[70]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-ink/70 backdrop-blur-sm" onClick={() => setOpen(false)} />
            <motion.aside
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 280, damping: 32 }}
              className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l border-line bg-surface p-6"
            >
              <div className="flex items-center justify-between">
                <h2 className="font-display text-4xl">Mes réservations</h2>
                <button onClick={() => setOpen(false)} className="grid h-10 w-10 place-items-center rounded-full border border-line" aria-label="Fermer">
                  ✕
                </button>
              </div>
              <p className="mt-2 text-sm text-muted">Réservations faites depuis cet appareil.</p>
              <div className="mt-6 grid gap-3 overflow-y-auto">
                {bookings.length === 0 && <p className="rounded-2xl border border-dashed border-line p-8 text-center text-muted">Aucune réservation à venir.</p>}
                {bookings
                  .slice()
                  .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
                  .map((b) => (
                    <div key={b.token} className="rounded-2xl border border-line bg-ink p-4">
                      <p className="font-display text-2xl">{b.course}</p>
                      <p className="text-sm text-muted first-letter:uppercase">
                        {fmtDayLong(b.startsAt)} · {fmtTime(b.startsAt)} · {b.room}
                      </p>
                      <button
                        onClick={() => cancel(b)}
                        disabled={busy === b.token}
                        className="mt-3 text-sm text-blaze underline underline-offset-4 disabled:opacity-50"
                      >
                        {busy === b.token ? "Annulation…" : "Annuler ma place"}
                      </button>
                    </div>
                  ))}
              </div>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
