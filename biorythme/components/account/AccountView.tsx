"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { useState, useTransition } from "react";
import { cancelMyBooking, changePassword, signOut, updateProfile } from "@/app/actions";
import { fmtDayLong, fmtTime } from "@/lib/format";
import type { Member } from "@/lib/member-auth";
import { CLUBS, type ClubId } from "@/lib/site";
import { Field } from "./AuthForm";
import { useMember } from "./MemberProvider";

export type MyBooking = {
  id: string;
  created_at: string;
  session: {
    id: string;
    starts_at: string;
    duration_min: number;
    cancelled: boolean;
    course: { name: string; color: string };
    room: { name: string; club: ClubId };
  };
};

export default function AccountView({ member, bookings }: { member: Member; bookings: MyBooking[] }) {
  const router = useRouter();
  const { setMember } = useMember();
  const [pending, start] = useTransition();
  const now = Date.now();
  const upcoming = bookings
    .filter((b) => new Date(b.session.starts_at).getTime() > now)
    .sort((a, b) => a.session.starts_at.localeCompare(b.session.starts_at));
  const past = bookings
    .filter((b) => new Date(b.session.starts_at).getTime() <= now)
    .sort((a, b) => b.session.starts_at.localeCompare(a.session.starts_at));

  function logout() {
    start(async () => {
      await signOut();
      setMember(null);
      router.refresh();
    });
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr]">
      <div>
        <div className="flex items-end justify-between gap-4">
          <h2 className="font-display text-4xl">Mes prochains cours</h2>
          <Link href="/planning" className="text-sm text-muted hover:text-volt">
            Réserver →
          </Link>
        </div>
        <div className="mt-5 grid gap-3">
          <AnimatePresence initial={false}>
            {upcoming.length === 0 && (
              <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-3xl border border-dashed border-line p-10 text-center">
                <p className="text-muted">Aucun cours réservé pour l&apos;instant.</p>
                <Link href="/planning" className="mt-4 inline-flex rounded-full bg-volt px-6 py-3 font-semibold text-ink">
                  Voir le planning
                </Link>
              </motion.div>
            )}
            {upcoming.map((b) => (
              <BookingRow key={b.id} b={b} cancellable onCancelled={() => router.refresh()} />
            ))}
          </AnimatePresence>
        </div>

        {past.length > 0 && (
          <>
            <h2 className="font-display mt-12 text-3xl text-muted">Historique</h2>
            <div className="mt-4 grid gap-2">
              {past.slice(0, 20).map((b) => (
                <BookingRow key={b.id} b={b} />
              ))}
            </div>
          </>
        )}
      </div>

      <div className="grid content-start gap-6">
        <ProfileCard member={member} />
        <PasswordCard />
        <button
          onClick={logout}
          disabled={pending}
          className="rounded-full border border-line py-3 text-sm font-semibold text-muted transition hover:border-blaze hover:text-blaze"
        >
          {pending ? "Déconnexion…" : "Se déconnecter"}
        </button>
      </div>
    </div>
  );
}

function BookingRow({ b, cancellable = false, onCancelled }: { b: MyBooking; cancellable?: boolean; onCancelled?: () => void }) {
  const [busy, setBusy] = useState(false);
  const s = b.session;
  async function cancel() {
    if (!confirm(`Annuler votre place au cours ${s.course.name} ?`)) return;
    setBusy(true);
    await cancelMyBooking(b.id);
    setBusy(false);
    onCancelled?.();
  }
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -40 }}
      className={`relative flex items-center justify-between gap-4 overflow-hidden rounded-2xl border border-line bg-surface p-4 sm:p-5 ${
        cancellable ? "" : "opacity-60"
      }`}
    >
      <span className="absolute inset-y-0 left-0 w-1" style={{ background: s.course.color }} />
      <div className="min-w-0">
        <p className="font-display text-2xl">
          {s.course.name}
          {s.cancelled && <span className="ml-2 align-middle text-xs font-bold uppercase text-blaze">annulé par le club</span>}
        </p>
        <p className="truncate text-sm text-muted first-letter:uppercase">
          {fmtDayLong(s.starts_at)} · {fmtTime(s.starts_at)} · {s.room.name}, {CLUBS[s.room.club].short}
        </p>
      </div>
      {cancellable && !s.cancelled && (
        <button onClick={cancel} disabled={busy} className="shrink-0 text-sm text-blaze underline underline-offset-4 disabled:opacity-50">
          {busy ? "…" : "Annuler"}
        </button>
      )}
    </motion.div>
  );
}

function ProfileCard({ member }: { member: Member }) {
  const { setMember } = useMember();
  const [f, setF] = useState({ firstName: member.first_name, lastName: member.last_name, phone: member.phone });
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [pending, start] = useTransition();
  const dirty = f.firstName !== member.first_name || f.lastName !== member.last_name || f.phone !== member.phone;

  function save(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const res = await updateProfile(f);
      if (res.ok) {
        setMember({ ...member, first_name: f.firstName.trim(), last_name: f.lastName.trim(), phone: f.phone.trim() });
        setMsg({ text: "Profil enregistré", ok: true });
      } else setMsg({ text: res.error, ok: false });
    });
  }

  return (
    <form onSubmit={save} className="grid gap-3 rounded-3xl border border-line bg-surface p-6">
      <h2 className="font-display text-3xl">Mes infos</h2>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Prénom" value={f.firstName} onChange={(e) => setF({ ...f, firstName: e.target.value })} required />
        <Field label="Nom" value={f.lastName} onChange={(e) => setF({ ...f, lastName: e.target.value })} required />
      </div>
      <Field label="Email" value={member.email} disabled />
      <Field label="Téléphone" type="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
      {msg && <p className={`text-sm ${msg.ok ? "text-volt" : "text-blaze"}`}>{msg.text}</p>}
      <button disabled={!dirty || pending} className="rounded-full bg-bone py-3 text-sm font-semibold text-ink transition hover:bg-volt disabled:opacity-40">
        {pending ? "…" : "Enregistrer"}
      </button>
    </form>
  );
}

function PasswordCard() {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ current: "", next: "" });
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [pending, start] = useTransition();

  function save(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const res = await changePassword(f);
      setMsg(res.ok ? { text: "Mot de passe modifié", ok: true } : { text: res.error, ok: false });
      if (res.ok) setF({ current: "", next: "" });
    });
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="rounded-3xl border border-line bg-surface p-6 text-left text-sm text-muted hover:text-bone">
        Changer mon mot de passe →
      </button>
    );
  }
  return (
    <form onSubmit={save} className="grid gap-3 rounded-3xl border border-line bg-surface p-6">
      <h2 className="font-display text-3xl">Mot de passe</h2>
      <Field label="Mot de passe actuel" type="password" autoComplete="current-password" value={f.current} onChange={(e) => setF({ ...f, current: e.target.value })} required />
      <Field label="Nouveau (8 caractères min.)" type="password" autoComplete="new-password" minLength={8} value={f.next} onChange={(e) => setF({ ...f, next: e.target.value })} required />
      {msg && <p className={`text-sm ${msg.ok ? "text-volt" : "text-blaze"}`}>{msg.text}</p>}
      <button disabled={pending} className="rounded-full bg-bone py-3 text-sm font-semibold text-ink transition hover:bg-volt disabled:opacity-40">
        {pending ? "…" : "Modifier"}
      </button>
    </form>
  );
}
