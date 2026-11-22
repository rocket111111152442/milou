"use client";

import { useEffect, useState } from "react";
import type { ContactRequest, RequestType } from "@/lib/types";

const LABELS: Record<RequestType, { l: string; c: string }> = {
  "reservation-table": { l: "Table", c: "bg-mustard" },
  atelier: { l: "Atelier", c: "bg-sage text-white" },
  anniversaire: { l: "Anniversaire", c: "bg-coral" },
  contact: { l: "Contact", c: "bg-ink text-white" },
};

const DETAIL_LABELS: Record<string, string> = {
  atelier: "Atelier",
  seance: "Séance",
  participants: "Enfants",
  date: "Date",
  heure: "Heure",
  personnes: "Adultes",
  enfants: "Enfants",
  prenom_enfant: "Prénom enfant",
  age: "Âge",
  invites: "Invités",
  sujet: "Sujet",
};

export function AdminRequests() {
  const [items, setItems] = useState<ContactRequest[] | null>(null);
  const [filter, setFilter] = useState<"tous" | RequestType>("tous");
  const [onlyNew, setOnlyNew] = useState(false);

  async function load() {
    const res = await fetch("/api/admin/requests", { cache: "no-store" });
    if (res.status === 401) return location.replace("/admin/login");
    setItems(await res.json());
  }
  useEffect(() => {
    load();
  }, []);

  async function toggle(r: ContactRequest) {
    const status = r.status === "nouveau" ? "traite" : "nouveau";
    setItems((list) => list?.map((x) => (x.id === r.id ? { ...x, status } : x)) ?? null);
    await fetch("/api/admin/requests", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: r.id, status }) });
  }

  async function remove(r: ContactRequest) {
    if (!confirm("Supprimer cette demande ?")) return;
    await fetch(`/api/admin/requests?id=${encodeURIComponent(r.id)}`, { method: "DELETE" });
    load();
  }

  const list = (items ?? []).filter((r) => (filter === "tous" || r.type === filter) && (!onlyNew || r.status === "nouveau"));

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-4xl">Demandes reçues</h1>
      <p className="text-ink-soft">Réservations de table, d&apos;ateliers, demandes d&apos;anniversaire et messages envoyés depuis le site.</p>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        {(["tous", "reservation-table", "atelier", "anniversaire", "contact"] as const).map((t) => (
          <button key={t} onClick={() => setFilter(t)} className={`rounded-full px-4 py-2 text-sm font-bold ${filter === t ? "bg-ink text-white" : "bg-white ring-1 ring-ink/10"}`}>
            {t === "tous" ? "Toutes" : LABELS[t].l}
          </button>
        ))}
        <label className="ml-2 flex items-center gap-2 text-sm font-bold">
          <input type="checkbox" checked={onlyNew} onChange={(e) => setOnlyNew(e.target.checked)} className="h-4 w-4" /> Non traitées uniquement
        </label>
        <button onClick={load} className="ml-auto rounded-full bg-white px-4 py-2 text-sm font-bold ring-1 ring-ink/10">↻ Actualiser</button>
      </div>

      {!items ? (
        <p className="mt-8">Chargement…</p>
      ) : list.length === 0 ? (
        <p className="mt-8 rounded-3xl bg-white p-8 text-center text-ink-soft">Aucune demande.</p>
      ) : (
        <div className="mt-6 grid gap-3">
          {list.map((r) => (
            <div key={r.id} className={`card p-5 ${r.status === "traite" ? "opacity-60" : ""}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-3 py-0.5 text-xs font-extrabold uppercase ${LABELS[r.type].c}`}>{LABELS[r.type].l}</span>
                    <span className="text-sm text-ink-soft">{new Date(r.createdAt).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Paris" })}</span>
                    {r.status === "nouveau" && <span className="rounded-full bg-tomato px-2 py-0.5 text-xs font-bold text-white">nouveau</span>}
                  </div>
                  <p className="mt-2 font-display text-xl font-semibold">{r.name}</p>
                  <p className="text-sm">
                    {r.phone && <a className="mr-4 font-bold text-sage-deep" href={`tel:${r.phone}`}>📞 {r.phone}</a>}
                    {r.email && <a className="font-bold text-sage-deep" href={`mailto:${r.email}`}>✉️ {r.email}</a>}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => toggle(r)} className={`rounded-full px-4 py-2 text-sm font-bold ${r.status === "nouveau" ? "bg-sage-deep text-white" : "bg-white ring-1 ring-ink/15"}`}>
                    {r.status === "nouveau" ? "✓ Marquer traitée" : "Remettre en nouveau"}
                  </button>
                  <button onClick={() => remove(r)} className="rounded-full px-3 py-2 text-sm text-tomato hover:bg-shell" aria-label="Supprimer">🗑</button>
                </div>
              </div>
              {Object.keys(r.details).length > 0 && (
                <dl className="mt-3 flex flex-wrap gap-2">
                  {Object.entries(r.details).map(([k, v]) => (
                    <div key={k} className="rounded-xl bg-cream px-3 py-1 text-sm">
                      <dt className="inline font-bold">{DETAIL_LABELS[k] ?? k} : </dt>
                      <dd className="inline">{v}</dd>
                    </div>
                  ))}
                </dl>
              )}
              {r.message && <p className="mt-3 rounded-2xl bg-cream p-3 whitespace-pre-line">{r.message}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
