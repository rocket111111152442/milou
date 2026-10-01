"use client";

import { useMemo, useState, useTransition } from "react";
import { resetMemberPassword } from "@/app/admin/actions";
import type { Notify } from "./AdminDashboard";
import { inputCls } from "./ui";

export type AdminMember = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  created_at: string;
  bookings: number;
};

const dateFmt = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric" });

export default function MembersList({ members, notify }: { members: AdminMember[]; notify: Notify }) {
  const [q, setQ] = useState("");
  const [temp, setTemp] = useState<{ id: string; password: string } | null>(null);
  const [pending, start] = useTransition();

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return members;
    return members.filter((m) => `${m.first_name} ${m.last_name} ${m.email} ${m.phone}`.toLowerCase().includes(s));
  }, [members, q]);

  function reset(m: AdminMember) {
    if (!confirm(`Générer un mot de passe provisoire pour ${m.first_name} ${m.last_name} ? L'ancien ne fonctionnera plus.`)) return;
    start(async () => {
      const res = await resetMemberPassword(m.id);
      if (res.ok) setTemp({ id: m.id, password: res.password });
      else notify(res.error, "error");
    });
  }

  return (
    <div className="max-w-4xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-6xl">Membres</h1>
          <p className="mt-2 text-sm text-muted">{members.length} compte{members.length > 1 ? "s" : ""} créé{members.length > 1 ? "s" : ""} sur le site.</p>
        </div>
        <input className={`${inputCls} max-w-xs`} placeholder="Rechercher…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <div className="mt-8 grid gap-2">
        {filtered.length === 0 && <p className="rounded-2xl border border-dashed border-line p-8 text-center text-muted">Aucun membre.</p>}
        {filtered.map((m) => (
          <div key={m.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-4">
            <div className="min-w-0">
              <p className="font-semibold">
                {m.first_name} {m.last_name}
              </p>
              <p className="truncate text-xs text-muted">
                <a href={`mailto:${m.email}`} className="hover:text-bone">{m.email}</a>
                {m.phone && (
                  <>
                    {" · "}
                    <a href={`tel:${m.phone}`} className="hover:text-bone">{m.phone}</a>
                  </>
                )}
                {" · inscrit le "}
                {dateFmt.format(new Date(m.created_at))}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm">
                <span className="font-display text-2xl text-volt">{m.bookings}</span> <span className="text-muted">résa.</span>
              </span>
              {temp?.id === m.id ? (
                <span className="rounded-xl bg-volt px-3 py-2 font-mono text-sm text-ink" title="À communiquer au membre">
                  {temp.password}
                </span>
              ) : (
                <button onClick={() => reset(m)} disabled={pending} className="text-xs text-muted underline underline-offset-4 hover:text-bone">
                  Mot de passe oublié
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      {temp && (
        <p className="mt-4 text-sm text-muted">
          Communiquez ce mot de passe provisoire au membre : il pourra le changer depuis « Mon compte ».
        </p>
      )}
    </div>
  );
}
