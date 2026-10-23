"use client";

import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Check, GripVertical, ImagePlus, Loader2, Plus, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { create } from "zustand";
import { cn } from "@/lib/cn";

// ---------------- API ----------------

export async function api<T = unknown>(url: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(url, {
    method: opts.method || (opts.body ? "POST" : "GET"),
    headers: opts.body ? { "Content-Type": "application/json" } : undefined,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) {
    window.location.href = "/admin/login";
    throw new Error("Session expirée");
  }
  if (!res.ok) throw new Error((data as { error?: string }).error || `Erreur ${res.status}`);
  return data as T;
}

// ---------------- Toasts ----------------

type Toast = { id: number; text: string; tone: "ok" | "error" };
const useToasts = create<{ list: Toast[]; push: (t: Omit<Toast, "id">) => void; drop: (id: number) => void }>((set) => ({
  list: [],
  push: (t) => {
    const id = Date.now() + Math.random();
    set((s) => ({ list: [...s.list, { ...t, id }] }));
    setTimeout(() => set((s) => ({ list: s.list.filter((x) => x.id !== id) })), 3800);
  },
  drop: (id) => set((s) => ({ list: s.list.filter((x) => x.id !== id) })),
}));

export const toast = {
  ok: (text: string) => useToasts.getState().push({ text, tone: "ok" }),
  error: (text: string) => useToasts.getState().push({ text, tone: "error" }),
};

export function Toaster() {
  const { list, drop } = useToasts();
  return (
    <div className="fixed bottom-5 right-5 z-[300] flex flex-col gap-2">
      <AnimatePresence>
        {list.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: 40 }}
            className={cn("flex items-center gap-3 rounded-xl px-4 py-3 text-sm shadow-xl", t.tone === "ok" ? "bg-aubergine-900 text-ivory" : "bg-red-600 text-white")}
          >
            {t.tone === "ok" ? <Check className="h-4 w-4 text-gold" /> : <AlertTriangle className="h-4 w-4" />}
            {t.text}
            <button onClick={() => drop(t.id)} className="opacity-60 hover:opacity-100" aria-label="Fermer">
              <X className="h-3.5 w-3.5" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

// ---------------- Mise en page ----------------

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div>
        <h1 className="font-display text-4xl text-noir">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-noir/55">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ title, children, className, actions }: { title?: string; children: React.ReactNode; className?: string; actions?: React.ReactNode }) {
  return (
    <section className={cn("adm-card p-5 sm:p-6", className)}>
      {(title || actions) && (
        <div className="mb-5 flex items-center justify-between gap-3">
          {title && <h2 className="text-sm font-semibold uppercase tracking-wider text-noir/70">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn("adm-chip", className || "bg-noir/[0.06] text-noir/70")}>{children}</span>;
}

export function Empty({ text }: { text: string }) {
  return <p className="rounded-xl border border-dashed border-noir/15 p-8 text-center text-sm text-noir/45">{text}</p>;
}

// ---------------- Champs ----------------

export function Label({ children, help }: { children: React.ReactNode; help?: string }) {
  return (
    <span className="adm-label">
      {children}
      {help && <span className="ml-1 normal-case tracking-normal text-noir/35">— {help}</span>}
    </span>
  );
}

export function TextField({ label, value, onChange, help, type = "text", placeholder, required, className }: { label: string; value: string; onChange: (v: string) => void; help?: string; type?: string; placeholder?: string; required?: boolean; className?: string }) {
  return (
    <label className={cn("block", className)}>
      <Label help={help}>
        {label}
        {required && " *"}
      </Label>
      <input type={type} value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} required={required} className="adm-input" />
    </label>
  );
}

export function TextArea({ label, value, onChange, rows = 4, help, className }: { label: string; value: string; onChange: (v: string) => void; rows?: number; help?: string; className?: string }) {
  return (
    <label className={cn("block", className)}>
      <Label help={help}>{label}</Label>
      <textarea value={value ?? ""} onChange={(e) => onChange(e.target.value)} rows={rows} className="adm-input resize-y" />
    </label>
  );
}

export function NumberField({ label, value, onChange, help, min, step = 1, className, nullable }: { label: string; value: number | null; onChange: (v: number | null) => void; help?: string; min?: number; step?: number; className?: string; nullable?: boolean }) {
  return (
    <label className={cn("block", className)}>
      <Label help={help}>{label}</Label>
      <input
        type="number"
        value={value ?? ""}
        min={min}
        step={step}
        placeholder={nullable ? "Illimité" : undefined}
        onChange={(e) => onChange(e.target.value === "" ? (nullable ? null : 0) : Number(e.target.value))}
        className="adm-input"
      />
    </label>
  );
}

/** Saisie en euros, stockage en centimes. */
export function MoneyField({ label, value, onChange, help, className, nullable }: { label: string; value: number | null; onChange: (v: number | null) => void; help?: string; className?: string; nullable?: boolean }) {
  const [text, setText] = useState(value == null ? "" : (value / 100).toFixed(2).replace(".", ","));
  useEffect(() => {
    setText(value == null ? "" : (value / 100).toFixed(2).replace(".", ","));
  }, [value]);
  return (
    <label className={cn("block", className)}>
      <Label help={help}>{label}</Label>
      <div className="relative">
        <input
          inputMode="decimal"
          value={text}
          placeholder={nullable ? "—" : "0,00"}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => {
            if (text.trim() === "" && nullable) return onChange(null);
            const n = Math.round(parseFloat(text.replace(",", ".").replace(/\s/g, "")) * 100);
            onChange(Number.isFinite(n) ? Math.max(0, n) : 0);
          }}
          className="adm-input pr-8"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-noir/40">€</span>
      </div>
    </label>
  );
}

export function Toggle({ label, checked, onChange, help }: { label: string; checked: boolean; onChange: (v: boolean) => void; help?: string }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 rounded-lg border border-noir/[0.07] bg-noir/[0.015] px-3 py-2.5">
      <span className="text-sm text-noir/80">
        {label}
        {help && <span className="block text-xs text-noir/40">{help}</span>}
      </span>
      <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className={cn("relative h-6 w-11 shrink-0 rounded-full transition", checked ? "bg-aubergine-600" : "bg-noir/15")}>
        <motion.span layout className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow", checked ? "right-0.5" : "left-0.5")} transition={{ type: "spring", stiffness: 500, damping: 30 }} />
      </button>
    </label>
  );
}

export function Select({ label, value, onChange, options, className, help }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; className?: string; help?: string }) {
  return (
    <label className={cn("block", className)}>
      <Label help={help}>{label}</Label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="adm-input">
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function MultiSelect({ label, value, onChange, options, className }: { label: string; value: string[]; onChange: (v: string[]) => void; options: { value: string; label: string }[]; className?: string }) {
  return (
    <div className={className}>
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const on = value.includes(o.value);
          return (
            <button
              type="button"
              key={o.value}
              onClick={() => onChange(on ? value.filter((v) => v !== o.value) : [...value, o.value])}
              className={cn("rounded-full border px-3 py-1 text-xs transition", on ? "border-aubergine-600 bg-aubergine-600 text-white" : "border-noir/10 text-noir/60 hover:border-noir/30")}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function TagsField({ label, value, onChange, help, className, placeholder }: { label: string; value: string[]; onChange: (v: string[]) => void; help?: string; className?: string; placeholder?: string }) {
  const [text, setText] = useState(value.join(", "));
  useEffect(() => setText(value.join(", ")), [value]);
  return (
    <label className={cn("block", className)}>
      <Label help={help || "séparés par des virgules"}>{label}</Label>
      <input
        value={text}
        placeholder={placeholder}
        onChange={(e) => setText(e.target.value)}
        onBlur={() =>
          onChange(
            text
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean),
          )
        }
        className="adm-input"
      />
    </label>
  );
}

export function ColorsField({ label, value, onChange }: { label: string; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="flex flex-wrap items-center gap-2">
        {value.map((c, i) => (
          <span key={i} className="group relative">
            <input type="color" value={c} onChange={(e) => onChange(value.map((x, k) => (k === i ? e.target.value : x)))} className="h-9 w-9 cursor-pointer rounded-lg border border-noir/10" />
            <button type="button" onClick={() => onChange(value.filter((_, k) => k !== i))} className="absolute -right-1.5 -top-1.5 hidden rounded-full bg-noir p-0.5 text-white group-hover:block" aria-label="Retirer">
              <X className="h-2.5 w-2.5" />
            </button>
          </span>
        ))}
        {value.length < 8 && (
          <button type="button" onClick={() => onChange([...value, "#B9A2CF"])} className="flex h-9 w-9 items-center justify-center rounded-lg border border-dashed border-noir/20 text-noir/40 hover:border-noir/40" aria-label="Ajouter une couleur">
            <Plus className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}

// ---------------- Images ----------------

async function compress(file: File, max = 1600, quality = 0.82): Promise<Blob> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return file;
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return new Promise((res) => canvas.toBlob((b) => res(b || file), "image/webp", quality));
}

export async function uploadImage(file: File): Promise<string> {
  let blob = await compress(file);
  // sans stockage externe, on vise une image plus légère
  if (blob.size > 850 * 1024) blob = await compress(file, 1100, 0.72);
  const fd = new FormData();
  fd.append("file", new File([blob], file.name.replace(/\.\w+$/, ".webp"), { type: blob.type || "image/webp" }));
  const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Échec du téléversement");
  return data.url as string;
}

const thumb = (src: string) => (src.startsWith("https://images.unsplash.com") ? `${src.split("?")[0]}?w=240&q=60&auto=format&fit=crop` : src);

export function ImagesField({ label, value, onChange, max = 8, help }: { label: string; value: string[]; onChange: (v: string[]) => void; max?: number; help?: string }) {
  const [busy, setBusy] = useState(false);
  const [url, setUrl] = useState("");
  const [drag, setDrag] = useState<number | null>(null);
  const input = useRef<HTMLInputElement>(null);
  async function files(list: FileList | null) {
    if (!list?.length) return;
    setBusy(true);
    try {
      const out: string[] = [];
      for (const f of Array.from(list).slice(0, max - value.length)) out.push(await uploadImage(f));
      onChange([...value, ...out]);
      toast.ok(`${out.length} image(s) ajoutée(s)`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    }
    setBusy(false);
  }
  return (
    <div>
      <Label help={help || "glisser pour réordonner — la 1re est l'image principale"}>{label}</Label>
      <div className="flex flex-wrap gap-2">
        {value.map((src, i) => (
          <div
            key={src + i}
            draggable
            onDragStart={() => setDrag(i)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (drag == null || drag === i) return;
              const next = [...value];
              const [m] = next.splice(drag, 1);
              next.splice(i, 0, m);
              onChange(next);
              setDrag(null);
            }}
            className={cn("group relative h-24 w-20 overflow-hidden rounded-lg border bg-noir/5", i === 0 ? "border-aubergine-500 ring-2 ring-aubergine-500/20" : "border-noir/10")}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={thumb(src)} alt="" className="h-full w-full object-cover" />
            <span className="absolute left-1 top-1 cursor-grab rounded bg-white/80 p-0.5 opacity-0 group-hover:opacity-100">
              <GripVertical className="h-3 w-3" />
            </span>
            <button type="button" onClick={() => onChange(value.filter((_, k) => k !== i))} className="absolute right-1 top-1 rounded bg-red-600 p-0.5 text-white opacity-0 group-hover:opacity-100" aria-label="Supprimer l'image">
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        ))}
        {value.length < max && (
          <button
            type="button"
            onClick={() => input.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              files(e.dataTransfer.files);
            }}
            className="flex h-24 w-20 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-noir/20 text-[0.65rem] text-noir/45 hover:border-aubergine-500 hover:text-aubergine-600"
          >
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
            Ajouter
          </button>
        )}
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple={max > 1} className="hidden" onChange={(e) => files(e.target.files)} />
      </div>
      {value.length < max && (
        <div className="mt-2 flex gap-2">
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="…ou coller l'adresse d'une image (https://…)" className="adm-input !py-1.5 text-xs" />
          <button
            type="button"
            className="adm-btn adm-btn-ghost !py-1.5 text-xs"
            onClick={() => {
              if (/^https:\/\//.test(url)) {
                onChange([...value, url.trim()]);
                setUrl("");
              } else toast.error("Adresse invalide (https:// requis)");
            }}
          >
            Ajouter
          </button>
        </div>
      )}
    </div>
  );
}

export function ImageField({ label, value, onChange, help }: { label: string; value: string; onChange: (v: string) => void; help?: string }) {
  return <ImagesField label={label} help={help || "une seule image"} value={value ? [value] : []} max={1} onChange={(v) => onChange(v[0] || "")} />;
}

// ---------------- Tiroir & confirmation ----------------

export function Drawer({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; footer?: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[200]">
          <motion.button aria-label="Fermer" className="absolute inset-0 bg-noir/40 backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div
            className={cn("absolute inset-y-0 right-0 flex w-full flex-col bg-[#FBF9FC] shadow-2xl", wide ? "max-w-3xl" : "max-w-xl")}
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 36 }}
          >
            <div className="flex items-center justify-between border-b border-noir/[0.07] px-6 py-4">
              <h2 className="font-display text-2xl text-noir">{title}</h2>
              <button onClick={onClose} className="rounded-lg p-2 text-noir/50 hover:bg-noir/5" aria-label="Fermer">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 space-y-5 overflow-y-auto px-6 py-6">{children}</div>
            {footer && <div className="flex items-center justify-between gap-3 border-t border-noir/[0.07] bg-white px-6 py-4">{footer}</div>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export function confirmAction(message: string) {
  return window.confirm(message);
}

export function SaveBar({ dirty, saving, onSave, onReset }: { dirty: boolean; saving: boolean; onSave: () => void; onReset?: () => void }) {
  return (
    <AnimatePresence>
      {dirty && (
        <motion.div initial={{ y: 100 }} animate={{ y: 0 }} exit={{ y: 100 }} className="fixed bottom-5 left-1/2 z-[150] flex -translate-x-1/2 items-center gap-3 rounded-2xl bg-aubergine-950 px-4 py-3 text-sm text-ivory shadow-2xl lg:left-[calc(50%+130px)]">
          <span className="px-2">Modifications non enregistrées</span>
          {onReset && (
            <button onClick={onReset} className="adm-btn text-ivory/70 hover:text-ivory">
              Annuler
            </button>
          )}
          <button onClick={onSave} disabled={saving} className="adm-btn bg-gold text-noir hover:bg-gold-light">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Enregistrer
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Édition d'un document de paramètres avec barre d'enregistrement. */
export function useDocEditor<T>(name: string, initial: T) {
  const [doc, setDoc] = useState<T>(initial);
  const [saved, setSaved] = useState<T>(initial);
  const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify(doc) !== JSON.stringify(saved);
  async function save() {
    setSaving(true);
    try {
      const r = await api<{ doc: T }>(`/api/admin/d/${name}`, { method: "PUT", body: doc });
      setDoc(r.doc);
      setSaved(r.doc);
      toast.ok("Enregistré");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    }
    setSaving(false);
  }
  const patch = <K extends keyof T>(k: K, v: T[K]) => setDoc((d) => ({ ...d, [k]: v }));
  return { doc, setDoc, patch, dirty, saving, save, reset: () => setDoc(saved) };
}
