"use client";

/* eslint-disable @next/next/no-img-element */
import { motion } from "motion/react";
import { useRef, useState } from "react";
import { CATEGORIES, type CategoryId } from "@/lib/catalog";
import type { CustomProduct } from "@/lib/settings";
import { uploadPhoto } from "../actions";

export function toEuros(cents: number) {
  return (cents / 100).toFixed(2).replace(".", ",");
}

export function parseEuros(v: string): number | null {
  const n = Number(v.replace(",", ".").replace(/[^\d.]/g, ""));
  if (!Number.isFinite(n) || n <= 0 || n >= 1000) return null;
  return Math.round(n * 100);
}

/** Redimensionne la photo dans le navigateur (1400 px max, JPEG) avant l'envoi. */
async function shrink(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1400 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.85));
  return blob ? new File([blob], "photo.jpg", { type: "image/jpeg" }) : file;
}

const LEADS = [
  { v: 0, label: "Délai standard (2 h)" },
  { v: 24, label: "Sur commande 24 h" },
  { v: 48, label: "Sur commande 48 h" },
  { v: 72, label: "Sur commande 72 h" },
];

export function ProductForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: CustomProduct;
  onSave: (p: CustomProduct) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [category, setCategory] = useState<CategoryId>(initial?.category ?? "pains");
  const [price, setPrice] = useState(initial ? toEuros(initial.price) : "");
  const [unit, setUnit] = useState(initial?.unit ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [lead, setLead] = useState(initial?.leadHours ?? 0);
  const [image, setImage] = useState(initial?.image);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = async (file?: File) => {
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("photo", await shrink(file));
      setImage(await uploadPhoto(fd));
    } catch (e) {
      setError(`Photo : ${(e as Error).message}`);
    } finally {
      setUploading(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cents = parseEuros(price);
    if (!name.trim()) return setError("Donnez un nom au produit.");
    if (cents === null) return setError("Prix invalide (ex. 3,50).");
    setSaving(true);
    setError(null);
    try {
      await onSave({
        id: initial?.id ?? `perso-${Math.random().toString(36).slice(2, 10)}`,
        name: name.trim(),
        category,
        price: cents,
        unit: unit.trim() || undefined,
        description: description.trim(),
        image,
        leadHours: lead || undefined,
      });
    } catch (err) {
      setError(`Échec de l'enregistrement : ${(err as Error).message}`);
      setSaving(false);
    }
  };

  const field = "h-11 w-full rounded-xl border border-mie bg-farine px-3 outline-none focus:border-croute focus:ring-4 focus:ring-croute/10";

  return (
    <motion.div className="fixed inset-0 z-50 flex items-end justify-center bg-torref/50 p-0 backdrop-blur-sm sm:items-center sm:p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onCancel}>
      <motion.form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 60, opacity: 0 }}
        transition={{ type: "spring", stiffness: 320, damping: 32 }}
        className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-[2rem] bg-creme p-6 shadow-2xl sm:rounded-[2rem] sm:p-8"
        data-lenis-prevent
      >
        <h2 className="font-display text-3xl">{initial ? "Modifier le produit" : "Nouveau produit"}</h2>

        <div className="mt-6 grid gap-5 sm:grid-cols-[180px_1fr]">
          <div>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="relative grid aspect-square w-full place-items-center overflow-hidden rounded-2xl border-2 border-dashed border-sable bg-farine text-sm text-grege transition hover:border-croute"
            >
              {image ? <img src={image} alt="" className="absolute inset-0 h-full w-full object-cover" /> : <span className="px-3 text-center">📷 Ajouter une photo</span>}
              {uploading && <span className="absolute inset-0 grid place-items-center bg-creme/80 font-semibold text-cafe">Envoi…</span>}
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
            {image && (
              <button type="button" onClick={() => setImage(undefined)} className="mt-2 text-xs font-semibold text-grege hover:text-croute">
                Retirer la photo
              </button>
            )}
          </div>

          <div className="grid gap-4">
            <label className="block">
              <span className="mb-1 block text-sm font-semibold">Nom *</span>
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} required className={field} placeholder="Ex. Fougasse aux olives" />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-sm font-semibold">Rayon</span>
                <select value={category} onChange={(e) => setCategory(e.target.value as CategoryId)} className={field}>
                  {CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-semibold">Prix (€) *</span>
                <input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" required className={field} placeholder="3,50" />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-sm font-semibold">Format</span>
                <input value={unit} onChange={(e) => setUnit(e.target.value)} maxLength={30} className={field} placeholder="400 g, la part, 6 parts…" />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-semibold">Délai de commande</span>
                <select value={lead} onChange={(e) => setLead(Number(e.target.value))} className={field}>
                  {LEADS.map((l) => (
                    <option key={l.v} value={l.v}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        </div>

        <label className="mt-4 block">
          <span className="mb-1 block text-sm font-semibold">Description</span>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} rows={3} className={`${field} h-auto py-2`} placeholder="Ce qui le rend bon, en une ou deux phrases." />
        </label>

        {error && <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onCancel} className="h-11 rounded-full border border-mie px-5 text-sm font-semibold transition hover:bg-mie">
            Annuler
          </button>
          <button type="submit" disabled={saving || uploading} className="h-11 rounded-full bg-croute px-6 text-sm font-semibold text-creme transition hover:bg-cafe disabled:opacity-50">
            {saving ? "Enregistrement…" : initial ? "Enregistrer" : "Ajouter à la carte"}
          </button>
        </div>
      </motion.form>
    </motion.div>
  );
}
