"use client";

import { useState, useTransition } from "react";
import { deleteItem, saveItem } from "@/app/admin/actions";
import { CLUBS } from "@/lib/site";
import type { Coach, Course, Room } from "@/lib/types";
import type { Notify } from "./AdminDashboard";
import { Btn, inputCls, Label } from "./ui";

type Kind = "rooms" | "courses" | "coaches";
type Item = Room | Course | Coach;

const TABLE = { rooms: "bio_rooms", courses: "bio_courses", coaches: "bio_coaches" } as const;

const META: Record<Kind, { title: string; intro: string; add: string; empty: Record<string, unknown>; warn: string }> = {
  rooms: {
    title: "Salles",
    intro: "Les studios et salles de chaque club. La capacité sert de nombre de places par défaut pour les nouveaux cours.",
    add: "Ajouter une salle",
    empty: { club: "six-fours", name: "", capacity: 20, color: "#d7ff3a", position: 0 },
    warn: "Supprimer cette salle supprimera aussi tous ses cours planifiés et leurs inscriptions. Continuer ?",
  },
  courses: {
    title: "Cours",
    intro: "Les types de cours proposés. Leur durée est reprise par défaut lors de la planification.",
    add: "Ajouter un cours",
    empty: { name: "", description: "", intensity: 2, duration_min: 45, color: "#d7ff3a" },
    warn: "Supprimer ce type de cours supprimera aussi toutes ses séances planifiées et leurs inscriptions. Continuer ?",
  },
  coaches: {
    title: "Coachs",
    intro: "L'équipe. Un coach supprimé est simplement retiré des séances concernées.",
    add: "Ajouter un coach",
    empty: { name: "", specialty: "" },
    warn: "Supprimer ce coach ?",
  },
};

const COLORS = ["#d7ff3a", "#ff4d2e", "#7cf5ff", "#ffb02e", "#c084fc", "#f3f2ec"];

export default function RefsEditor({ kind, items, notify }: { kind: Kind; items: Item[]; notify: Notify }) {
  const meta = META[kind];
  const [draft, setDraft] = useState<Record<string, unknown> | null>(null);

  return (
    <div className="max-w-3xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-6xl">{meta.title}</h1>
          <p className="mt-2 max-w-xl text-sm text-muted">{meta.intro}</p>
        </div>
        <Btn onClick={() => setDraft({ ...meta.empty })}>+ {meta.add}</Btn>
      </div>

      <div className="mt-8 grid gap-3">
        {draft && <Row kind={kind} item={draft} notify={notify} onDone={() => setDraft(null)} isNew />}
        {items.length === 0 && !draft && <p className="rounded-2xl border border-dashed border-line p-8 text-center text-muted">Rien pour l&apos;instant.</p>}
        {items.map((it) => (
          <Row key={it.id} kind={kind} item={it as unknown as Record<string, unknown>} notify={notify} />
        ))}
      </div>
    </div>
  );
}

function Row({
  kind,
  item,
  notify,
  onDone,
  isNew = false,
}: {
  kind: Kind;
  item: Record<string, unknown>;
  notify: Notify;
  onDone?: () => void;
  isNew?: boolean;
}) {
  const [v, setV] = useState(item);
  const [pending, start] = useTransition();
  const dirty = isNew || JSON.stringify(v) !== JSON.stringify(item);
  const set = (k: string, val: unknown) => setV((p) => ({ ...p, [k]: val }));
  const str = (k: string) => String(v[k] ?? "");
  const num = (k: string) => Number(v[k] ?? 0);

  function save(e: React.FormEvent) {
    e.preventDefault();
    const { created_at: _c, ...fields } = v;
    void _c;
    start(async () => {
      const res = await saveItem(TABLE[kind], fields);
      if (res.ok) {
        notify("Enregistré");
        onDone?.();
      } else notify(res.error, "error");
    });
  }

  function remove() {
    if (!confirm(META[kind].warn)) return;
    start(async () => {
      const res = await deleteItem(TABLE[kind], String(item.id));
      if (res.ok) notify("Supprimé");
      else notify(res.error, "error");
    });
  }

  return (
    <form onSubmit={save} className={`grid gap-3 rounded-2xl border bg-surface p-4 ${isNew ? "border-volt/60" : "border-line"}`}>
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <Label text="Nom">
          <input required className={inputCls} value={str("name")} onChange={(e) => set("name", e.target.value)} />
        </Label>
        {kind === "rooms" && (
          <Label text="Club">
            <select className={inputCls} value={str("club")} onChange={(e) => set("club", e.target.value)}>
              {Object.values(CLUBS).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.city}
                </option>
              ))}
            </select>
          </Label>
        )}
      </div>

      {kind === "rooms" && (
        <div className="grid grid-cols-2 gap-3">
          <Label text="Places par défaut">
            <input type="number" min={1} className={inputCls} value={num("capacity")} onChange={(e) => set("capacity", Number(e.target.value))} />
          </Label>
          <Label text="Ordre d'affichage">
            <input type="number" className={inputCls} value={num("position")} onChange={(e) => set("position", Number(e.target.value))} />
          </Label>
        </div>
      )}

      {kind === "courses" && (
        <>
          <Label text="Description">
            <textarea rows={2} className={inputCls} value={str("description")} onChange={(e) => set("description", e.target.value)} />
          </Label>
          <div className="grid grid-cols-2 gap-3">
            <Label text="Durée (min)">
              <input type="number" min={10} className={inputCls} value={num("duration_min")} onChange={(e) => set("duration_min", Number(e.target.value))} />
            </Label>
            <Label text="Intensité">
              <select className={inputCls} value={num("intensity")} onChange={(e) => set("intensity", Number(e.target.value))}>
                <option value={1}>Douce</option>
                <option value={2}>Modérée</option>
                <option value={3}>Intense</option>
              </select>
            </Label>
          </div>
        </>
      )}

      {kind === "coaches" && (
        <Label text="Spécialité">
          <input className={inputCls} value={str("specialty")} onChange={(e) => set("specialty", e.target.value)} placeholder="Pilates, RPM…" />
        </Label>
      )}

      {kind !== "coaches" && (
        <div>
          <span className="mb-1.5 block text-xs uppercase tracking-[0.15em] text-muted">Couleur</span>
          <div className="flex gap-2">
            {COLORS.map((c) => (
              <button
                type="button"
                key={c}
                onClick={() => set("color", c)}
                className={`h-8 w-8 rounded-full border-2 ${v.color === c ? "border-bone" : "border-transparent"}`}
                style={{ background: c }}
                aria-label={`Couleur ${c}`}
              />
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap justify-end gap-2">
        {isNew ? (
          <Btn type="button" variant="ghost" onClick={onDone}>
            Annuler
          </Btn>
        ) : (
          <Btn type="button" variant="danger" onClick={remove} disabled={pending}>
            Supprimer
          </Btn>
        )}
        <Btn type="submit" disabled={pending || !dirty}>
          {pending ? "…" : isNew ? "Créer" : "Enregistrer"}
        </Btn>
      </div>
    </form>
  );
}
