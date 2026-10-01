"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState, useTransition } from "react";
import { bookSession } from "@/app/actions";
import { fmtDayLong, fmtTime } from "@/lib/format";
import { CLUBS } from "@/lib/site";
import type { SessionFull } from "@/lib/types";
import AuthForm from "../account/AuthForm";
import { useMember } from "../account/MemberProvider";

export default function BookingSheet({
  session,
  onClose,
  onBooked,
}: {
  session: SessionFull | null;
  onClose: () => void;
  onBooked: (s: SessionFull) => void;
}) {
  const { member, setMember } = useMember();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();

  useEffect(() => {
    setError(null);
    setDone(false);
  }, [session?.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const left = session ? Math.max(0, session.capacity - session.booked_count) : 0;

  function confirm() {
    if (!session) return;
    setError(null);
    start(async () => {
      const res = await bookSession(session.id);
      if (!res.ok) {
        if (res.needLogin) setMember(null);
        setError(res.error);
        return;
      }
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

            <div className="mt-6 flex items-center justify-between rounded-2xl bg-ink px-4 py-3 text-sm">
              <span className="text-muted">Places restantes</span>
              <motion.span key={left} initial={{ scale: 1.3 }} animate={{ scale: 1 }} className={`font-display text-2xl ${left ? "text-volt" : "text-blaze"}`}>
                {left}
              </motion.span>
            </div>

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
                  <p className="mt-2 text-muted">Retrouvez et gérez vos réservations depuis votre compte, sur n&apos;importe quel appareil.</p>
                  <div className="mt-6 grid gap-2">
                    <button onClick={onClose} className="w-full rounded-full bg-bone py-4 font-semibold text-ink hover:bg-volt">
                      Parfait
                    </button>
                    <Link href="/compte" className="text-sm text-muted underline underline-offset-4 hover:text-bone">
                      Voir mes réservations
                    </Link>
                  </div>
                </motion.div>
              ) : !member ? (
                <motion.div key="auth" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-6">
                  <AuthForm intro="Connectez-vous ou créez votre compte pour réserver. Vos infos seront remplies automatiquement la prochaine fois." />
                </motion.div>
              ) : (
                <motion.div key="confirm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-6 grid gap-3">
                  <div className="rounded-2xl border border-line bg-ink p-4">
                    <p className="text-xs uppercase tracking-[0.15em] text-muted">Réservé au nom de</p>
                    <p className="mt-1 text-lg font-semibold">
                      {member.first_name} {member.last_name}
                    </p>
                    <p className="text-sm text-muted">
                      {member.email}
                      {member.phone && ` · ${member.phone}`}
                    </p>
                  </div>
                  {error && (
                    <motion.p initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl bg-blaze/15 px-4 py-3 text-sm text-blaze">
                      {error}
                    </motion.p>
                  )}
                  <button
                    onClick={confirm}
                    disabled={pending || left === 0}
                    className="mt-1 rounded-full bg-volt py-4 font-semibold text-ink transition hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
                  >
                    {pending ? "Réservation…" : left === 0 ? "Complet" : "Confirmer ma place"}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
