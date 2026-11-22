"use client";

import { useState } from "react";

const PRESETS = [
  "/images/ateliers/cinq-sens.webp",
  "/images/ateliers/mini-english.webp",
  "/images/ateliers/baby-sensory.webp",
  "/images/ateliers/immersion-anglais.webp",
  "/images/ateliers/patisserie.webp",
  "/images/ateliers/eveil-musical.webp",
  "/images/ateliers/comptines.webp",
  "/images/ateliers/danse.webp",
  "/images/ateliers/messy-play.webp",
  "/images/ateliers/body-painting.webp",
  "/images/ateliers/reflexologie.webp",
  "/images/ateliers/cercle-mamans.webp",
  "/images/ateliers/auto-coaching.webp",
  "/images/ateliers/retraite-enchantee.webp",
  "/images/ateliers/chouet-foraine.webp",
  "/images/ateliers/bourse-jouets.webp",
  "/images/ateliers/halloween.webp",
  "/images/table-brunch.webp",
  "/images/pancakes.webp",
  "/images/toast-avocat.webp",
  "/images/smoothies.webp",
  "/images/gateau-anniversaire.webp",
  "/images/salle.webp",
];

/** Redimensionne l'image côté navigateur (max 1600 px, WebP) avant l'envoi */
async function compress(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/gif") return file;
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  const blob: Blob | null = await new Promise((r) => canvas.toBlob(r, "image/webp", 0.82));
  if (!blob) return file;
  return new File([blob], file.name.replace(/\.\w+$/, "") + ".webp", { type: "image/webp" });
}

export function ImagePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function upload(f: File) {
    setBusy(true);
    setErr("");
    try {
      const fd = new FormData();
      fd.append("file", await compress(f));
      const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      onChange(json.url);
      setOpen(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erreur d'envoi");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-4">
        <div className="h-24 w-32 shrink-0 overflow-hidden rounded-2xl bg-white ring-1 ring-ink/10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {value && <img src={value} alt="" className="h-full w-full object-cover" />}
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="cursor-pointer rounded-full bg-ink px-4 py-2 text-sm font-bold text-white">
            {busy ? "Envoi…" : "📷 Envoyer une photo"}
            <input type="file" accept="image/*" className="hidden" disabled={busy} onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
          </label>
          <button type="button" onClick={() => setOpen((o) => !o)} className="rounded-full bg-white px-4 py-2 text-sm font-bold ring-1 ring-ink/15">
            Choisir dans la bibliothèque
          </button>
        </div>
      </div>
      {err && <p className="mt-2 text-sm font-bold text-tomato">{err}</p>}
      {open && (
        <div className="mt-3 grid grid-cols-4 gap-2 rounded-2xl bg-white p-3 ring-1 ring-ink/10 sm:grid-cols-6">
          {PRESETS.map((p) => (
            <button
              type="button"
              key={p}
              onClick={() => {
                onChange(p);
                setOpen(false);
              }}
              className={`aspect-square overflow-hidden rounded-xl ring-2 ${value === p ? "ring-tomato" : "ring-transparent"}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
