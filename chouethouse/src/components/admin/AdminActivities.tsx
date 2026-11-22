"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import type { Activity, ActivityCategory, ActivityKind, Session } from "@/lib/types";
import { CATEGORY_LABELS, KIND_LABELS } from "@/lib/types";
import { formatDate, formatTime, slugify, todayISO, uid } from "@/lib/format";
import { ImagePicker } from "./ImagePicker";
import { Toast, useToast } from "./Toast";

const EMPTY: Activity = {
  id: "",
  slug: "",
  title: "",
  kind: "atelier",
  category: "eveil",
  ageLabel: "",
  price: 20,
  description: "",
  image: "/images/ateliers/cinq-sens.webp",
  published: true,
  sessions: [],
};

function addDays(date: string, n: number) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function AdminActivities() {
  const [items, setItems] = useState<Activity[] | null>(null);
  const [edit, setEdit] = useState<Activity | null>(null);
  const [q, setQ] = useState("");
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  async function load() {
    const res = await fetch("/api/admin/activities", { cache: "no-store" });
    if (res.status === 401) return location.replace("/admin/login");
    setItems(await res.json());
  }
  useEffect(() => {
    load();
  }, []);

  const today = todayISO();
  const filtered = useMemo(
    () => (items ?? []).filter((a) => (a.title + a.ageLabel + a.category).toLowerCase().includes(q.toLowerCase())),
    [items, q]
  );

  async function save() {
    if (!edit) return;
    setSaving(true);
    const res = await fetch("/api/admin/activities", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(edit) });
    setSaving(false);
    if (!res.ok) return toast.show((await res.json()).error || "Erreur", "error");
    toast.show("Activité enregistrée ✔");
    setEdit(null);
    load();
  }

  async function remove(a: Activity) {
    if (!confirm(`Supprimer « ${a.title} » ? Cette action est définitive.`)) return;
    await fetch(`/api/admin/activities?id=${encodeURIComponent(a.id)}`, { method: "DELETE" });
    toast.show("Activité supprimée");
    load();
  }

  async function togglePublish(a: Activity) {
    await fetch("/api/admin/activities", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...a, published: !a.published }) });
    load();
  }

  const set = <K extends keyof Activity>(k: K, v: Activity[K]) => setEdit((e) => (e ? { ...e, [k]: v } : e));
  const setSession = (i: number, patch: Partial<Session>) =>
    setEdit((e) => (e ? { ...e, sessions: e.sessions.map((s, j) => (j === i ? { ...s, ...patch } : s)) } : e));

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl">Activités & horaires</h1>
          <p className="text-ink-soft">Ateliers, stages et événements affichés sur le site, avec leurs séances.</p>
        </div>
        <button className="btn-primary" onClick={() => setEdit({ ...EMPTY, id: "", sessions: [] })}>
          + Nouvelle activité
        </button>
      </div>

      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher…" className="field mt-6 max-w-sm" />

      {!items ? (
        <p className="mt-8">Chargement…</p>
      ) : (
        <div className="mt-6 grid gap-3">
          {filtered.map((a) => {
            const next = a.sessions.filter((s) => s.date >= today);
            return (
              <div key={a.id} className="card flex flex-wrap items-center gap-4 p-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={a.image} alt="" className="h-16 w-16 rounded-2xl bg-cream object-contain" />
                <div className="min-w-0 flex-1">
                  <p className="font-display text-xl font-semibold">
                    {a.title} {!a.published && <span className="ml-1 rounded-full bg-ink/10 px-2 py-0.5 align-middle text-xs">brouillon</span>}
                  </p>
                  <p className="text-sm text-ink-soft">
                    {KIND_LABELS[a.kind]} · {CATEGORY_LABELS[a.category]} · {a.ageLabel} · {a.price} €
                  </p>
                  <p className="text-sm font-bold text-sage-deep">
                    {next.length ? `${next.length} séance(s) à venir · prochaine : ${formatDate(next[0].date, { day: "numeric", month: "short" })} ${formatTime(next[0].start)}` : "Aucune séance à venir"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => togglePublish(a)} className="rounded-full bg-white px-3 py-2 text-sm font-bold ring-1 ring-ink/15">
                    {a.published ? "Masquer" : "Publier"}
                  </button>
                  <button onClick={() => setEdit(structuredClone(a))} className="rounded-full bg-sage-deep px-4 py-2 text-sm font-bold text-white">
                    Modifier
                  </button>
                  <button onClick={() => remove(a)} className="rounded-full px-3 py-2 text-sm font-bold text-tomato hover:bg-shell" aria-label="Supprimer">
                    🗑
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <AnimatePresence>
        {edit && (
          <motion.div className="fixed inset-0 z-50 flex justify-end bg-ink/40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 260, damping: 30 }}
              className="h-full w-full max-w-3xl overflow-y-auto bg-cream p-5 sm:p-8"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-3xl">{edit.id ? "Modifier l'activité" : "Nouvelle activité"}</h2>
                <button onClick={() => setEdit(null)} className="grid h-10 w-10 place-items-center rounded-full bg-white text-2xl ring-1 ring-ink/10" aria-label="Fermer">
                  ×
                </button>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="label">Titre *</label>
                  <input className="field" value={edit.title} onChange={(e) => set("title", e.target.value)} placeholder="Ex. : Éveil musical" />
                </div>
                <div>
                  <label className="label">Type</label>
                  <select className="field" value={edit.kind} onChange={(e) => set("kind", e.target.value as ActivityKind)}>
                    {Object.entries(KIND_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Thème</label>
                  <select className="field" value={edit.category} onChange={(e) => set("category", e.target.value as ActivityCategory)}>
                    {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Âge</label>
                  <input className="field" value={edit.ageLabel} onChange={(e) => set("ageLabel", e.target.value)} placeholder="Ex. : 12 mois – 4 ans" />
                </div>
                <div>
                  <label className="label">Durée</label>
                  <input className="field" value={edit.duration ?? ""} onChange={(e) => set("duration", e.target.value)} placeholder="Ex. : 45 min" />
                </div>
                <div>
                  <label className="label">Prix (€)</label>
                  <input className="field" type="number" min={0} step="0.5" value={edit.price} onChange={(e) => set("price", Number(e.target.value))} />
                </div>
                <div>
                  <label className="label">Précision tarif</label>
                  <input className="field" value={edit.priceNote ?? ""} onChange={(e) => set("priceNote", e.target.value)} placeholder="Ex. : 190 € la semaine" />
                </div>
                <div>
                  <label className="label">Animé par</label>
                  <input className="field" value={edit.host ?? ""} onChange={(e) => set("host", e.target.value)} placeholder="Ex. : Lauren" />
                </div>
                <div>
                  <label className="label">Rythme (texte libre)</label>
                  <input className="field" value={edit.recurring ?? ""} onChange={(e) => set("recurring", e.target.value)} placeholder="Ex. : Tous les mercredis à 10 h" />
                </div>
                <div className="col-span-2">
                  <label className="label">Description</label>
                  <textarea className="field" rows={4} value={edit.description} onChange={(e) => set("description", e.target.value)} />
                </div>
                <div className="col-span-2">
                  <label className="label">Image</label>
                  <ImagePicker value={edit.image} onChange={(v) => set("image", v)} />
                </div>
                <div className="col-span-2 flex flex-wrap gap-6">
                  <label className="flex items-center gap-2 font-bold">
                    <input type="checkbox" className="h-5 w-5 accent-[#4f7f78]" checked={edit.published} onChange={(e) => set("published", e.target.checked)} /> Visible sur le site
                  </label>
                  <label className="flex items-center gap-2 font-bold">
                    <input type="checkbox" className="h-5 w-5 accent-[#4f7f78]" checked={!!edit.featured} onChange={(e) => set("featured", e.target.checked)} /> Mettre en avant
                  </label>
                </div>
                <details className="col-span-2">
                  <summary className="cursor-pointer text-sm font-bold text-ink-soft">Adresse de la page (SEO)</summary>
                  <input className="field mt-2" value={edit.slug} onChange={(e) => set("slug", e.target.value)} placeholder={slugify(edit.title || "mon-atelier")} />
                </details>
              </div>

              {/* SÉANCES */}
              <div className="mt-8 rounded-3xl bg-white p-5 ring-1 ring-ink/10">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-2xl">Séances (dates & horaires)</h3>
                  <button
                    type="button"
                    className="rounded-full bg-mustard px-4 py-2 text-sm font-bold"
                    onClick={() => {
                      const last = edit.sessions[edit.sessions.length - 1];
                      set("sessions", [
                        ...edit.sessions,
                        last
                          ? { ...last, id: uid("s-"), date: addDays(last.date, 7) }
                          : { id: uid("s-"), date: today, start: "10:00", end: "11:00", spots: null },
                      ]);
                    }}
                  >
                    + Ajouter une séance
                  </button>
                </div>
                <p className="mt-1 text-sm text-ink-soft">Astuce : « + Ajouter » reprend la dernière séance une semaine plus tard. Les séances passées sont masquées automatiquement sur le site.</p>

                <div className="mt-4 space-y-3">
                  {edit.sessions.length === 0 && <p className="text-ink-soft">Aucune séance : l&apos;activité s&apos;affichera avec « Dates à venir · sur demande ».</p>}
                  {edit.sessions.map((s, i) => (
                    <div key={s.id} className={`grid grid-cols-2 gap-2 rounded-2xl p-3 sm:grid-cols-[1.4fr_1fr_1fr_0.8fr_auto] ${s.date < today ? "bg-ink/5 opacity-60" : "bg-cream"}`}>
                      <div className="col-span-2 sm:col-span-1">
                        <label className="label">Date</label>
                        <input type="date" className="field py-2" value={s.date} onChange={(e) => setSession(i, { date: e.target.value })} />
                      </div>
                      <div>
                        <label className="label">Début</label>
                        <input type="time" className="field py-2" value={s.start} onChange={(e) => setSession(i, { start: e.target.value })} />
                      </div>
                      <div>
                        <label className="label">Fin</label>
                        <input type="time" className="field py-2" value={s.end} onChange={(e) => setSession(i, { end: e.target.value })} />
                      </div>
                      <div>
                        <label className="label">Places</label>
                        <input
                          type="number"
                          min={0}
                          className="field py-2"
                          value={s.spots ?? ""}
                          placeholder="—"
                          onChange={(e) => setSession(i, { spots: e.target.value === "" ? null : Number(e.target.value) })}
                        />
                      </div>
                      <div className="flex items-end gap-1">
                        <button
                          type="button"
                          title="Dupliquer à +7 jours"
                          className="h-11 rounded-xl bg-white px-3 font-bold ring-1 ring-ink/10"
                          onClick={() => set("sessions", [...edit.sessions.slice(0, i + 1), { ...s, id: uid("s-"), date: addDays(s.date, 7) }, ...edit.sessions.slice(i + 1)])}
                        >
                          +7j
                        </button>
                        <button type="button" title="Supprimer" className="h-11 rounded-xl px-3 text-tomato hover:bg-shell" onClick={() => set("sessions", edit.sessions.filter((_, j) => j !== i))}>
                          🗑
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <RepeatHelper
                  onAdd={(list) => set("sessions", [...edit.sessions, ...list].sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start)))}
                />
              </div>

              <div className="sticky bottom-0 -mx-5 mt-8 flex gap-3 bg-cream/95 px-5 py-4 backdrop-blur sm:-mx-8 sm:px-8">
                <button onClick={save} disabled={saving} className="btn-primary disabled:opacity-60">
                  {saving ? "Enregistrement…" : "Enregistrer"}
                </button>
                <button onClick={() => setEdit(null)} className="btn-ghost">Annuler</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <Toast {...toast} />
    </div>
  );
}

/** Générer une série hebdomadaire de séances */
function RepeatHelper({ onAdd }: { onAdd: (s: Session[]) => void }) {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(todayISO());
  const [start, setStart] = useState("10:00");
  const [end, setEnd] = useState("11:00");
  const [weeks, setWeeks] = useState(4);
  const [spots, setSpots] = useState<string>("");

  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="mt-4 text-sm font-bold text-sage-deep underline">
        ↻ Créer une série hebdomadaire (ex. : tous les mercredis pendant 6 semaines)
      </button>
    );

  return (
    <div className="mt-4 grid grid-cols-2 gap-2 rounded-2xl bg-mint p-4 sm:grid-cols-5">
      <div className="col-span-2 sm:col-span-1">
        <label className="label">1re date</label>
        <input type="date" className="field py-2" value={from} onChange={(e) => setFrom(e.target.value)} />
      </div>
      <div>
        <label className="label">Début</label>
        <input type="time" className="field py-2" value={start} onChange={(e) => setStart(e.target.value)} />
      </div>
      <div>
        <label className="label">Fin</label>
        <input type="time" className="field py-2" value={end} onChange={(e) => setEnd(e.target.value)} />
      </div>
      <div>
        <label className="label">Semaines</label>
        <input type="number" min={1} max={52} className="field py-2" value={weeks} onChange={(e) => setWeeks(Number(e.target.value))} />
      </div>
      <div>
        <label className="label">Places</label>
        <input type="number" min={0} className="field py-2" value={spots} placeholder="—" onChange={(e) => setSpots(e.target.value)} />
      </div>
      <div className="col-span-2 flex gap-2 sm:col-span-5">
        <button
          type="button"
          className="rounded-full bg-sage-deep px-4 py-2 text-sm font-bold text-white"
          onClick={() => {
            onAdd(
              Array.from({ length: Math.max(1, Math.min(52, weeks)) }, (_, i) => ({
                id: uid("s-"),
                date: addDays(from, i * 7),
                start,
                end,
                spots: spots === "" ? null : Number(spots),
              }))
            );
            setOpen(false);
          }}
        >
          Ajouter {weeks} séance(s)
        </button>
        <button type="button" className="text-sm font-bold" onClick={() => setOpen(false)}>Annuler</button>
      </div>
    </div>
  );
}
