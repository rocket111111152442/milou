"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { duplicateWeek } from "@/app/admin/actions";
import { addDays, dayKey, fmtDayNum, fmtDayShort, fmtMonthShort, fmtTime, mondayOf } from "@/lib/format";
import { CLUBS, type ClubId } from "@/lib/site";
import type { SessionFull } from "@/lib/types";
import type { AdminData, Notify } from "./AdminDashboard";
import SessionEditor from "./SessionEditor";
import { Btn, Drawer } from "./ui";

export default function PlanningBoard({
  monday,
  rooms,
  coaches,
  courses,
  sessions,
  bookings,
  club,
  notify,
}: AdminData & { club: "all" | ClubId; notify: Notify }) {
  const router = useRouter();
  const [editing, setEditing] = useState<SessionFull | null>(null);
  const [creatingOn, setCreatingOn] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const visible = sessions.filter((s) => club === "all" || s.room.club === club);
  const today = dayKey(new Date());

  const stats = useMemo(() => {
    const active = visible.filter((s) => !s.cancelled);
    const places = active.reduce((a, s) => a + s.capacity, 0);
    const booked = active.reduce((a, s) => a + s.booked_count, 0);
    return { count: active.length, booked, rate: places ? Math.round((booked / places) * 100) : 0 };
  }, [visible]);

  const goWeek = (d: string) => router.push(`/admin?week=${d}`);
  const label = `${fmtDayNum(new Date(`${monday}T12:00:00Z`))} ${fmtMonthShort(new Date(`${monday}T12:00:00Z`))} → ${fmtDayNum(
    new Date(`${addDays(monday, 6)}T12:00:00Z`),
  )} ${fmtMonthShort(new Date(`${addDays(monday, 6)}T12:00:00Z`))}`;

  function onDuplicate() {
    if (!confirm("Copier toutes les séances de cette semaine sur la semaine suivante ?")) return;
    start(async () => {
      const res = await duplicateWeek(monday);
      if (res.ok) {
        notify(`${res.count} séances copiées sur la semaine suivante`);
        goWeek(addDays(monday, 7));
      } else notify(res.error, "error");
    });
  }

  const editingFresh = editing ? sessions.find((s) => s.id === editing.id) ?? null : null;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Btn variant="ghost" onClick={() => goWeek(addDays(monday, -7))} aria-label="Semaine précédente">←</Btn>
          <div className="min-w-44 text-center">
            <p className="text-xs uppercase tracking-[0.15em] text-muted">Semaine</p>
            <p className="font-display text-2xl">{label}</p>
          </div>
          <Btn variant="ghost" onClick={() => goWeek(addDays(monday, 7))} aria-label="Semaine suivante">→</Btn>
          {mondayOf(today) !== monday && (
            <Btn variant="ghost" onClick={() => goWeek(mondayOf(today))}>Aujourd&apos;hui</Btn>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Btn variant="ghost" onClick={onDuplicate} disabled={pending}>
            {pending ? "Copie…" : "Copier vers semaine suivante"}
          </Btn>
          <Btn onClick={() => setCreatingOn(days.includes(today) ? today : monday)}>+ Ajouter un cours</Btn>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-3 gap-3">
        {[
          { v: stats.count, l: "séances" },
          { v: stats.booked, l: "places réservées" },
          { v: `${stats.rate}%`, l: "remplissage" },
        ].map((s) => (
          <div key={s.l} className="rounded-2xl border border-line bg-surface p-4">
            <p className="font-display text-4xl text-volt">{s.v}</p>
            <p className="text-xs text-muted">{s.l}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-3 lg:grid-cols-7">
        {days.map((d) => {
          const list = visible.filter((s) => dayKey(s.starts_at) === d);
          const date = new Date(`${d}T12:00:00Z`);
          return (
            <div key={d} className={`rounded-2xl border p-3 ${d === today ? "border-volt/60" : "border-line"} bg-surface/50`}>
              <div className="mb-3 flex items-baseline justify-between">
                <p className="text-sm">
                  <span className="uppercase text-muted">{fmtDayShort(date)}</span>{" "}
                  <span className="font-display text-2xl">{fmtDayNum(date)}</span>
                </p>
                <button onClick={() => setCreatingOn(d)} className="grid h-7 w-7 place-items-center rounded-full border border-line text-muted hover:border-volt hover:text-volt" aria-label="Ajouter un cours ce jour">
                  +
                </button>
              </div>
              <div className="grid gap-2">
                {list.length === 0 && <p className="py-4 text-center text-xs text-muted">—</p>}
                {list.map((s) => {
                  const ratio = s.capacity ? s.booked_count / s.capacity : 0;
                  return (
                    <button
                      key={s.id}
                      onClick={() => setEditing(s)}
                      className={`relative overflow-hidden rounded-xl border border-line bg-ink p-3 text-left transition hover:border-bone/40 ${
                        s.cancelled ? "opacity-50" : ""
                      }`}
                    >
                      <span className="absolute inset-y-0 left-0 w-1" style={{ background: s.course.color }} />
                      <p className="text-xs text-muted">
                        {fmtTime(s.starts_at)} · {s.duration_min}′
                      </p>
                      <p className="mt-0.5 font-semibold leading-tight">{s.course.name}</p>
                      <p className="truncate text-xs text-muted">
                        {s.room.name}
                        {club === "all" && ` · ${CLUBS[s.room.club].short}`}
                      </p>
                      <p className="truncate text-xs text-muted">{s.coach?.name ?? "Sans coach"}</p>
                      <div className="mt-2 flex items-center gap-2">
                        <div className="h-1 flex-1 overflow-hidden rounded-full bg-line">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${ratio * 100}%`, background: ratio >= 1 ? "var(--color-blaze)" : "var(--color-volt)" }}
                          />
                        </div>
                        <span className="text-xs font-semibold">
                          {s.booked_count}/{s.capacity}
                        </span>
                      </div>
                      <div className="mt-1 flex gap-1">
                        {s.cancelled && <Badge tone="blaze">Annulé</Badge>}
                        {!s.published && <Badge tone="muted">Brouillon</Badge>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <Drawer open={Boolean(creatingOn)} onClose={() => setCreatingOn(null)} title="Nouveau cours">
        {creatingOn && (
          <SessionEditor
            key={creatingOn}
            defaultDate={creatingOn}
            rooms={rooms.filter((r) => club === "all" || r.club === club)}
            coaches={coaches}
            courses={courses}
            notify={notify}
            onDone={() => setCreatingOn(null)}
          />
        )}
      </Drawer>

      <Drawer open={Boolean(editingFresh)} onClose={() => setEditing(null)} title={editingFresh?.course.name ?? ""}>
        {editingFresh && (
          <SessionEditor
            key={editingFresh.id}
            session={editingFresh}
            bookings={bookings.filter((b) => b.session_id === editingFresh.id)}
            rooms={rooms}
            coaches={coaches}
            courses={courses}
            notify={notify}
            onDone={() => setEditing(null)}
          />
        )}
      </Drawer>
    </div>
  );
}

function Badge({ children, tone }: { children: React.ReactNode; tone: "blaze" | "muted" }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
        tone === "blaze" ? "bg-blaze text-ink" : "bg-line text-muted"
      }`}
    >
      {children}
    </span>
  );
}
