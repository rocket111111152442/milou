"use client";

import { useState, useTransition } from "react";
import { createSession, deleteSession, removeBooking, updateSession } from "@/app/admin/actions";
import { dayKey, parisHHMM } from "@/lib/format";
import { CLUBS } from "@/lib/site";
import type { Booking, Coach, Course, Room, SessionFull } from "@/lib/types";
import type { Notify } from "./AdminDashboard";
import { Btn, Label, inputCls } from "./ui";

export default function SessionEditor({
  session,
  bookings = [],
  defaultDate,
  rooms,
  coaches,
  courses,
  notify,
  onDone,
}: {
  session?: SessionFull;
  bookings?: Booking[];
  defaultDate?: string;
  rooms: Room[];
  coaches: Coach[];
  courses: Course[];
  notify: Notify;
  onDone: () => void;
}) {
  const [pending, start] = useTransition();
  const [f, setF] = useState(() => ({
    course_id: session?.course_id ?? courses[0]?.id ?? "",
    room_id: session?.room_id ?? rooms[0]?.id ?? "",
    coach_id: session?.coach_id ?? "",
    date: session ? dayKey(session.starts_at) : defaultDate ?? dayKey(new Date()),
    time: session ? parisHHMM(session.starts_at) : "18:30",
    duration_min: session?.duration_min ?? courses[0]?.duration_min ?? 45,
    capacity: session?.capacity ?? rooms[0]?.capacity ?? 20,
    published: session?.published ?? true,
    repeat_weeks: 1,
  }));
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));

  if (!courses.length || !rooms.length) {
    return <p className="text-muted">Créez d&apos;abord au moins une salle et un type de cours (onglets Salles et Cours).</p>;
  }

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, success: string, close = true) {
    start(async () => {
      const res = await fn();
      if (res.ok) {
        notify(success);
        if (close) onDone();
      } else notify(res.error ?? "Erreur", "error");
    });
  }

  function save(e: React.FormEvent) {
    e.preventDefault();
    const payload = { ...f, coach_id: f.coach_id || null };
    if (session) {
      const { repeat_weeks: _ignored, ...patch } = payload;
      void _ignored;
      run(() => updateSession(session.id, patch), "Cours mis à jour");
    } else {
      run(
        () => createSession(payload),
        f.repeat_weeks > 1 ? `${f.repeat_weeks} séances créées` : "Cours ajouté au planning",
      );
    }
  }

  return (
    <div className="grid gap-8">
      <form onSubmit={save} className="grid gap-4">
        <Label text="Cours">
          <select
            className={inputCls}
            value={f.course_id}
            onChange={(e) => {
              const c = courses.find((x) => x.id === e.target.value);
              setF((p) => ({ ...p, course_id: e.target.value, duration_min: session ? p.duration_min : c?.duration_min ?? p.duration_min }));
            }}
          >
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Label>
        <div className="grid grid-cols-2 gap-3">
          <Label text="Salle">
            <select
              className={inputCls}
              value={f.room_id}
              onChange={(e) => {
                const r = rooms.find((x) => x.id === e.target.value);
                setF((p) => ({ ...p, room_id: e.target.value, capacity: session ? p.capacity : r?.capacity ?? p.capacity }));
              }}
            >
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({CLUBS[r.club].city})
                </option>
              ))}
            </select>
          </Label>
          <Label text="Coach">
            <select className={inputCls} value={f.coach_id} onChange={(e) => set("coach_id", e.target.value)}>
              <option value="">— Aucun —</option>
              {coaches.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Label text="Date">
            <input type="date" required className={inputCls} value={f.date} onChange={(e) => set("date", e.target.value)} />
          </Label>
          <Label text="Heure">
            <input type="time" required className={inputCls} value={f.time} onChange={(e) => set("time", e.target.value)} />
          </Label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Label text="Durée (min)">
            <input
              type="number"
              min={10}
              max={240}
              required
              className={inputCls}
              value={f.duration_min}
              onChange={(e) => set("duration_min", Number(e.target.value))}
            />
          </Label>
          <Label text="Nombre de places">
            <input
              type="number"
              min={Math.max(1, session?.booked_count ?? 1)}
              max={500}
              required
              className={inputCls}
              value={f.capacity}
              onChange={(e) => set("capacity", Number(e.target.value))}
            />
          </Label>
        </div>
        {!session && (
          <Label text="Répéter chaque semaine">
            <select className={inputCls} value={f.repeat_weeks} onChange={(e) => set("repeat_weeks", Number(e.target.value))}>
              {[1, 2, 4, 8, 12, 26].map((n) => (
                <option key={n} value={n}>
                  {n === 1 ? "Non, une seule fois" : `Oui, pendant ${n} semaines`}
                </option>
              ))}
            </select>
          </Label>
        )}
        <label className="flex items-center gap-3 text-sm">
          <input type="checkbox" checked={f.published} onChange={(e) => set("published", e.target.checked)} className="h-5 w-5 accent-[#d7ff3a]" />
          Publié (visible et réservable sur le site)
        </label>
        <Btn type="submit" disabled={pending} className="py-3.5">
          {pending ? "Enregistrement…" : session ? "Enregistrer" : "Publier le cours"}
        </Btn>
      </form>

      {session && (
        <>
          <div>
            <div className="flex items-baseline justify-between">
              <h3 className="font-display text-3xl">Inscrits</h3>
              <span className="text-sm text-muted">
                {session.booked_count} / {session.capacity}
              </span>
            </div>
            {bookings.length === 0 ? (
              <p className="mt-3 rounded-xl border border-dashed border-line p-6 text-center text-sm text-muted">Personne pour l&apos;instant.</p>
            ) : (
              <>
                <ul className="mt-3 grid gap-2">
                  {bookings.map((b, i) => (
                    <li key={b.id} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-ink p-3">
                      <div className="min-w-0">
                        <p className="font-semibold">
                          <span className="mr-2 text-muted">{i + 1}.</span>
                          {b.name}
                        </p>
                        <p className="truncate text-xs text-muted">
                          <a href={`mailto:${b.email}`} className="hover:text-bone">{b.email}</a>
                          {b.phone && (
                            <>
                              {" · "}
                              <a href={`tel:${b.phone}`} className="hover:text-bone">{b.phone}</a>
                            </>
                          )}
                        </p>
                      </div>
                      <button
                        disabled={pending}
                        onClick={() => confirm(`Retirer ${b.name} du cours ?`) && run(() => removeBooking(b.id), "Inscription retirée", false)}
                        className="shrink-0 text-xs text-blaze hover:underline"
                      >
                        Retirer
                      </button>
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => {
                    navigator.clipboard?.writeText(bookings.map((b) => b.email).join(", "));
                    notify("Emails copiés");
                  }}
                  className="mt-3 text-sm text-muted underline underline-offset-4 hover:text-bone"
                >
                  Copier les emails des inscrits
                </button>
              </>
            )}
          </div>

          <div className="flex flex-wrap gap-2 border-t border-line pt-6">
            <Btn
              variant="ghost"
              disabled={pending}
              onClick={() =>
                run(
                  () => updateSession(session.id, { cancelled: !session.cancelled }),
                  session.cancelled ? "Cours rétabli" : "Cours annulé",
                  false,
                )
              }
            >
              {session.cancelled ? "Rétablir le cours" : "Annuler le cours"}
            </Btn>
            <Btn
              variant="danger"
              disabled={pending}
              onClick={() =>
                confirm(
                  session.booked_count
                    ? `Supprimer ce cours et ses ${session.booked_count} inscriptions ? (Préférez « Annuler » pour garder une trace.)`
                    : "Supprimer ce cours ?",
                ) && run(() => deleteSession(session.id), "Cours supprimé")
              }
            >
              Supprimer
            </Btn>
          </div>
        </>
      )}
    </div>
  );
}
