"use client";

import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { publicClient } from "@/lib/supabase";
import { fetchPublicSessions } from "@/lib/queries";
import { CLUBS, type ClubId } from "@/lib/site";
import type { SessionFull } from "@/lib/types";
import { dayKey, fmtDayNum, fmtDayShort, fmtMonthShort, fmtTime, fmtDayLong } from "@/lib/format";
import Link from "next/link";
import { myBookedSessionIds } from "@/app/actions";
import BookingSheet from "./BookingSheet";
import { useMember } from "../account/MemberProvider";

type Filter = "all" | ClubId;

const DAYS_AHEAD = 14;
const FILTER_LABELS: Record<Filter, string> = { all: "Tous les clubs", "six-fours": "Six-Fours", sanary: "Sanary" };

function rangeIso() {
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  const to = new Date(from.getTime() + (DAYS_AHEAD + 1) * 86_400_000);
  return { from: from.toISOString(), to: to.toISOString() };
}

export default function Planning({
  initial,
  initialClub = "all",
  initialBooked = [],
}: {
  initial: SessionFull[];
  initialClub?: Filter;
  initialBooked?: string[];
}) {
  const { member } = useMember();
  const [sessions, setSessions] = useState<SessionFull[]>(initial);
  const [club, setClub] = useState<Filter>(initialClub);
  const [selectedDay, setSelectedDay] = useState(() => dayKey(new Date()));
  const [booking, setBooking] = useState<SessionFull | null>(null);
  const [bookedIds, setBookedIds] = useState(() => new Set(initialBooked));
  const [live, setLive] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const sessionsRef = useRef(sessions);
  sessionsRef.current = sessions;

  // Connexion / déconnexion : on recharge les cours réservés par ce membre.
  const memberId = member?.id ?? null;
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (!memberId) setBookedIds(new Set());
    else myBookedSessionIds().then((ids) => setBookedIds(new Set(ids)));
  }, [memberId]);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const refetch = useCallback(async () => {
    const client = publicClient();
    if (!client) return;
    const { from, to } = rangeIso();
    try {
      setSessions(await fetchPublicSessions(client, from, to));
    } catch {
      /* on garde les données actuelles */
    }
  }, []);

  // Temps réel : chaque réservation, annulation ou modif de Sylvie arrive ici.
  useEffect(() => {
    const client = publicClient();
    if (!client) return;
    const channel = client
      .channel("bio-sessions")
      .on("postgres_changes", { event: "*", schema: "public", table: "bio_sessions" }, (payload) => {
        const row = payload.new as Partial<SessionFull>;
        const current = sessionsRef.current.find((s) => s.id === row.id);
        const simplePatch =
          payload.eventType === "UPDATE" &&
          current &&
          row.published &&
          row.course_id === current.course_id &&
          row.room_id === current.room_id &&
          row.coach_id === current.coach_id;
        if (simplePatch) {
          setSessions((prev) =>
            prev.map((s) => (s.id === row.id ? { ...s, ...row, course: s.course, room: s.room, coach: s.coach } : s)),
          );
        } else {
          // Nouvelle séance, suppression, changement de cours / salle / coach : on recharge.
          refetch();
        }
      })
      .subscribe((status) => setLive(status === "SUBSCRIBED"));
    // Filet de sécurité si le temps réel est coupé.
    const poll = setInterval(refetch, 45_000);
    return () => {
      clearInterval(poll);
      client.removeChannel(channel);
    };
  }, [refetch]);

  const days = useMemo(() => {
    const out: Date[] = [];
    const start = new Date();
    for (let i = 0; i < DAYS_AHEAD; i++) out.push(new Date(start.getTime() + i * 86_400_000));
    return out;
  }, []);

  const visible = useMemo(
    () => sessions.filter((s) => (club === "all" || s.room.club === club) && s.published),
    [sessions, club],
  );

  const countByDay = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of visible) {
      if (s.cancelled || new Date(s.starts_at).getTime() < now) continue;
      const k = dayKey(s.starts_at);
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return m;
  }, [visible, now]);

  const daySessions = visible.filter((s) => dayKey(s.starts_at) === selectedDay);
  const upcomingBooked = sessions.filter(
    (s) => bookedIds.has(s.id) && !s.cancelled && new Date(s.starts_at).getTime() > now,
  ).length;
  function onBooked(s: SessionFull) {
    setSessions((prev) => prev.map((x) => (x.id === s.id ? { ...x, booked_count: Math.min(x.capacity, x.booked_count + 1) } : x)));
    setBookedIds((prev) => new Set(prev).add(s.id));
  }

  return (
    <div>
      {/* Filtres */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex gap-1 rounded-full border border-line bg-surface p-1">
          {(["all", "six-fours", "sanary"] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setClub(f)}
              className={`relative rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                club === f ? "text-ink" : "text-bone/70 hover:text-bone"
              }`}
            >
              {club === f && (
                <motion.span layoutId="club-pill" className="absolute inset-0 rounded-full bg-volt" transition={{ type: "spring", stiffness: 400, damping: 32 }} />
              )}
              <span className="relative">{FILTER_LABELS[f]}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted">
            <span className="relative flex h-2 w-2">
              {live && <span className="absolute inset-0 animate-pulse-dot rounded-full bg-volt" />}
              <span className={`relative h-2 w-2 rounded-full ${live ? "bg-volt" : "bg-muted"}`} />
            </span>
            {live ? "Places en direct" : "Connexion…"}
          </span>
          <Link href="/compte" className="relative rounded-full border border-line px-4 py-2 text-sm font-medium hover:border-bone/40">
            Mes réservations
            {upcomingBooked > 0 && (
              <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-volt px-1 text-[11px] font-bold text-ink">
                {upcomingBooked}
              </span>
            )}
          </Link>
        </div>
      </div>

      {/* Jours */}
      <div className="no-scrollbar -mx-4 mt-8 flex gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
        {days.map((d) => {
          const k = dayKey(d);
          const on = k === selectedDay;
          const n = countByDay.get(k) ?? 0;
          return (
            <button
              key={k}
              onClick={() => setSelectedDay(k)}
              className={`relative flex min-w-[4.5rem] flex-col items-center rounded-2xl border px-3 py-3 transition-colors ${
                on ? "border-volt text-ink" : "border-line text-bone hover:border-bone/40"
              }`}
            >
              {on && <motion.span layoutId="day-pill" className="absolute inset-0 rounded-2xl bg-volt" transition={{ type: "spring", stiffness: 400, damping: 34 }} />}
              <span className="relative text-xs uppercase tracking-wider opacity-70">{fmtDayShort(d)}</span>
              <span className="font-display relative mt-1 text-3xl">{fmtDayNum(d)}</span>
              <span className="relative text-[10px] uppercase opacity-60">{fmtMonthShort(d)}</span>
              <span className={`relative mt-1 h-1 w-1 rounded-full ${n ? (on ? "bg-ink" : "bg-volt") : "bg-transparent"}`} />
            </button>
          );
        })}
      </div>

      <h2 className="mt-10 text-sm uppercase tracking-[0.2em] text-muted first-letter:uppercase">
        {fmtDayLong(`${selectedDay}T12:00:00Z`)}
      </h2>

      {/* Séances */}
      <div className="mt-4 grid gap-3">
        <AnimatePresence mode="popLayout">
          {daySessions.length === 0 && (
            <motion.p key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="rounded-3xl border border-dashed border-line p-10 text-center text-muted">
              Aucun cours programmé ce jour-là{club !== "all" ? " dans ce club" : ""}.
            </motion.p>
          )}
          {daySessions.map((s, i) => (
            <SessionCard
              key={s.id}
              s={s}
              index={i}
              now={now}
              booked={bookedIds.has(s.id)}
              showClub={club === "all"}
              onBook={() => setBooking(s)}
            />
          ))}
        </AnimatePresence>
      </div>

      <BookingSheet
        session={booking ? sessions.find((x) => x.id === booking.id) ?? booking : null}
        onClose={() => setBooking(null)}
        onBooked={onBooked}
      />
    </div>
  );
}

function SessionCard({
  s,
  index,
  now,
  booked,
  showClub,
  onBook,
}: {
  s: SessionFull;
  index: number;
  now: number;
  booked: boolean;
  showClub: boolean;
  onBook: () => void;
}) {
  const left = Math.max(0, s.capacity - s.booked_count);
  const past = new Date(s.starts_at).getTime() <= now;
  const full = left === 0;
  const ratio = s.capacity ? s.booked_count / s.capacity : 0;
  const barColor = full ? "var(--color-blaze)" : ratio > 0.75 ? "#ffb02e" : "var(--color-volt)";
  const disabled = past || full || s.cancelled || booked;

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: past || s.cancelled ? 0.45 : 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.45, delay: index * 0.04, ease: [0.22, 1, 0.36, 1] }}
      className="group relative grid grid-cols-[auto_1fr] items-center gap-x-5 gap-y-4 overflow-hidden rounded-3xl border border-line bg-surface p-5 transition-colors hover:border-bone/25 sm:grid-cols-[7rem_1fr_14rem_auto] sm:p-6"
    >
      <span className="absolute inset-y-0 left-0 w-1" style={{ background: s.course.color }} />
      <div>
        <p className="font-display text-4xl">{fmtTime(s.starts_at)}</p>
        <p className="text-xs text-muted">{s.duration_min} min</p>
      </div>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-display text-2xl sm:text-3xl">{s.course.name}</h3>
          <Intensity level={s.course.intensity} />
          {s.cancelled && <span className="rounded-full bg-blaze px-2 py-0.5 text-[10px] font-bold uppercase text-ink">Annulé</span>}
        </div>
        <p className="mt-1 truncate text-sm text-muted">
          {s.room.name}
          {showClub && ` · ${CLUBS[s.room.club].city}`}
          {" · "}
          {s.coach ? s.coach.name : "Coach Biorythme"}
        </p>
      </div>

      <div className="col-span-2 sm:col-span-1">
        <div className="flex items-baseline justify-between text-sm">
          <motion.span key={left} initial={{ scale: 1.25, color: "#d7ff3a" }} animate={{ scale: 1, color: "#f3f2ec" }} className="font-semibold">
            {full ? "Complet" : `${left} place${left > 1 ? "s" : ""}`}
          </motion.span>
          <span className="text-xs text-muted">
            {s.booked_count}/{s.capacity}
          </span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line">
          <motion.div
            className="h-full rounded-full"
            initial={false}
            animate={{ width: `${Math.min(100, ratio * 100)}%`, backgroundColor: barColor }}
            transition={{ type: "spring", stiffness: 120, damping: 20 }}
          />
        </div>
      </div>

      <button
        onClick={onBook}
        disabled={disabled}
        className={`col-span-2 rounded-full px-6 py-3 text-sm font-semibold transition sm:col-span-1 ${
          booked
            ? "bg-bone/10 text-volt"
            : disabled
              ? "cursor-not-allowed bg-line text-muted"
              : "bg-bone text-ink hover:scale-[1.03] hover:bg-volt active:scale-95"
        }`}
      >
        {booked ? "Réservé ✓" : s.cancelled ? "Annulé" : past ? "Terminé" : full ? "Complet" : "Réserver"}
      </button>
    </motion.article>
  );
}

function Intensity({ level }: { level: number }) {
  return (
    <span className="inline-flex items-end gap-0.5" title={`Intensité ${level}/3`} aria-label={`Intensité ${level} sur 3`}>
      {[1, 2, 3].map((i) => (
        <span key={i} className={`w-1 rounded-sm ${i <= level ? "bg-volt" : "bg-line"}`} style={{ height: 4 + i * 3 }} />
      ))}
    </span>
  );
}
