"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState, useTransition } from "react";
import { bookSession } from "@/app/actions";
import { fmtDayLong, fmtTime } from "@/lib/format";
import { CLUBS } from "@/lib/site";
import type { SessionFull } from "@/lib/types";
import { readMyBookings, writeMyBookings } from "./myBookings";

const PROFILE_KEY = "biorythme:profile";

export default function BookingSheet({
  session,
  onClose,
  onBooked,
}: {
  session: SessionFull | null;
  onClose: () => void;
  onBooked: (s: SessionFull) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!session) return;
    setError(null);
    setDone(false);
    try {
      const p = JSON.parse(localStorage.getItem(PROFILE_KEY) || "{}");
      setName(p.name ?? "");
      setEmail(p.email ?? "");
      setPhone(p.phone ?? "");
    } catch {
      /* pas de profil mémorisé */
    }
  }, [session?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const left = session ? Math.max(0, session.capacity - session.booked_count) : 0;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!session) return;
    setError(null);
    start(async () => {
      const res = await bookSession({ sessionId: session.id, name, email, phone });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      try {
        localStorage.setItem(PROFILE_KEY, JSON.stringify({ name, email, phone }));
      } catch {
        /* ignore */
      }
      writeMyBookings([
        ...readMyBookings(),
        { sessionId: session.id, token: res.token, course: session.course.name, startsAt: session.starts_at, room: session.room.name },
      ]);
      setDone(true);
      onBooked(session);
    });
  }

  return (
    <AnimatePresence>
      {session && (
        <motion.div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-ink/80 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={`Réserver ${session.course.name}`}
            initial={{ y: "100%", opacity: 0.5 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 30 }}
            className="relative max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-line bg-surface p-6 sm:rounded-3xl sm:p-8"
          >
            <button onClick={onClose} className="absolute right-5 top-5 grid h-10 w-10 place-items-center rounded-full border border-line text-muted hover:text-bone" aria-label="Fermer">
              ✕
            </button>

            <p className="text-xs uppercase tracking-[0.2em]" style={{ color: session.course.color }}>
              {CLUBS[session.room.club].city} · {session.room.name}
            </p>
            <h2 className="font-display mt-3 text-5xl">{session.course.name}</h2>
            <p className="mt-2 text-bone/80 first-letter:uppercase">
              {fmtDayLong(session.starts_at)} · {fmtTime(session.starts_at)} · {session.duration_min} min
            </p>
            {session.course.description && <p className="mt-3 text-sm text-muted">{session.course.description}</p>}

            <AnimatePresence mode="wait">
              {done ? (
                <motion.div key="done" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="mt-8 text-center">
                  <motion.div
                    initial={{ scale: 0, rotate: -90 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", stiffness: 260, damping: 16 }}
                    className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-volt text-4xl text-ink"
                  >
                    ✓
                  </motion.div>
                  <p className="font-display mt-6 text-4xl">C&apos;est réservé !</p>
                  <p className="mt-2 text-muted">
                    Votre place est bloquée. Un empêchement ? Annulez depuis « Mes réservations » pour libérer la place.
                  </p>
                  <button onClick={onClose} className="mt-6 w-full rounded-full bg-bone py-4 font-semibold text-ink hover:bg-volt">
                    Parfait
                  </button>
                </motion.div>
              ) : (
                <motion.form key="form" onSubmit={submit} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-8 grid gap-3">
                  <div className="flex items-center justify-between rounded-2xl bg-ink px-4 py-3 text-sm">
                    <span className="text-muted">Places restantes</span>
                    <motion.span key={left} initial={{ scale: 1.3 }} animate={{ scale: 1 }} className={`font-display text-2xl ${left ? "text-volt" : "text-blaze"}`}>
                      {left}
                    </motion.span>
                  </div>
                  <Field label="Nom et prénom" value={name} onChange={setName} autoComplete="name" required />
                  <Field label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" required />
                  <Field label="Téléphone (facultatif)" type="tel" value={phone} onChange={setPhone} autoComplete="tel" />
                  {error && (
                    <motion.p initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl bg-blaze/15 px-4 py-3 text-sm text-blaze">
                      {error}
                    </motion.p>
                  )}
                  <button
                    type="submit"
                    disabled={pending || left === 0}
                    className="mt-2 rounded-full bg-volt py-4 font-semibold text-ink transition hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
                  >
                    {pending ? "Réservation…" : left === 0 ? "Complet" : "Confirmer ma place"}
                  </button>
                </motion.form>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  ...rest
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  autoComplete?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs uppercase tracking-[0.15em] text-muted">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-2xl border border-line bg-ink px-4 py-3.5 outline-none transition focus:border-volt"
        {...rest}
      />
    </label>
  );
}
