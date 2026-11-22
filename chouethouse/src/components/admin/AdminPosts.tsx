"use client";

import { AnimatePresence, motion } from "motion/react";
import { marked } from "marked";
import { useEffect, useRef, useState } from "react";
import type { Post } from "@/lib/types";
import { slugify } from "@/lib/format";
import { ImagePicker } from "./ImagePicker";
import { Toast, useToast } from "./Toast";

const EMPTY: Post = {
  id: "",
  slug: "",
  title: "",
  excerpt: "",
  cover: "/images/table-brunch.webp",
  content: "",
  tags: [],
  published: true,
  date: "",
};

export function AdminPosts() {
  const [items, setItems] = useState<Post[] | null>(null);
  const [edit, setEdit] = useState<Post | null>(null);
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const ta = useRef<HTMLTextAreaElement>(null);

  async function load() {
    const res = await fetch("/api/admin/posts", { cache: "no-store" });
    if (res.status === 401) return location.replace("/admin/login");
    setItems(await res.json());
  }
  useEffect(() => {
    load();
  }, []);

  const set = <K extends keyof Post>(k: K, v: Post[K]) => setEdit((e) => (e ? { ...e, [k]: v } : e));

  async function save() {
    if (!edit) return;
    setSaving(true);
    const res = await fetch("/api/admin/posts", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(edit) });
    setSaving(false);
    if (!res.ok) return toast.show((await res.json()).error || "Erreur", "error");
    toast.show("Article enregistré ✔");
    setEdit(null);
    load();
  }

  async function remove(p: Post) {
    if (!confirm(`Supprimer l'article « ${p.title} » ?`)) return;
    await fetch(`/api/admin/posts?id=${encodeURIComponent(p.id)}`, { method: "DELETE" });
    toast.show("Article supprimé");
    load();
  }

  /** Barre d'outils markdown */
  function wrap(before: string, after = "", placeholder = "texte") {
    const el = ta.current;
    if (!el || !edit) return;
    const { selectionStart: a, selectionEnd: b, value } = el;
    const sel = value.slice(a, b) || placeholder;
    const next = value.slice(0, a) + before + sel + after + value.slice(b);
    set("content", next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(a + before.length, a + before.length + sel.length);
    });
  }

  async function insertImage() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async () => {
      const f = input.files?.[0];
      if (!f) return;
      const fd = new FormData();
      fd.append("file", f);
      const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) return toast.show(json.error || "Erreur", "error");
      wrap(`\n\n![`, `](${json.url})\n\n`, "description de l'image");
    };
    input.click();
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl">Blog / News</h1>
          <p className="text-ink-soft">Publiez vos actualités : nouveaux ateliers, événements, coulisses… (excellent pour le référencement Google !)</p>
        </div>
        <button className="btn-primary" onClick={() => { setEdit({ ...EMPTY, date: new Date().toISOString().slice(0, 10) }); setPreview(false); }}>
          + Nouvel article
        </button>
      </div>

      {!items ? (
        <p className="mt-8">Chargement…</p>
      ) : (
        <div className="mt-8 grid gap-3">
          {items.length === 0 && <p className="text-ink-soft">Aucun article pour l&apos;instant.</p>}
          {items.map((p) => (
            <div key={p.id} className="card flex flex-wrap items-center gap-4 p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.cover} alt="" className="h-16 w-24 rounded-2xl object-cover" />
              <div className="min-w-0 flex-1">
                <p className="font-display text-xl font-semibold">
                  {p.title} {!p.published && <span className="ml-1 rounded-full bg-ink/10 px-2 py-0.5 align-middle text-xs">brouillon</span>}
                </p>
                <p className="text-sm text-ink-soft">{new Date(p.date).toLocaleDateString("fr-FR")} · {p.tags.join(", ")}</p>
              </div>
              <div className="flex gap-2">
                {p.published && (
                  <a href={`/blog/${p.slug}`} target="_blank" className="rounded-full bg-white px-3 py-2 text-sm font-bold ring-1 ring-ink/15">Voir</a>
                )}
                <button onClick={() => { setEdit(structuredClone(p)); setPreview(false); }} className="rounded-full bg-sage-deep px-4 py-2 text-sm font-bold text-white">Modifier</button>
                <button onClick={() => remove(p)} className="rounded-full px-3 py-2 text-sm font-bold text-tomato hover:bg-shell" aria-label="Supprimer">🗑</button>
              </div>
            </div>
          ))}
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
              className="h-full w-full max-w-4xl overflow-y-auto bg-cream p-5 sm:p-8"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-3xl">{edit.id ? "Modifier l'article" : "Nouvel article"}</h2>
                <button onClick={() => setEdit(null)} className="grid h-10 w-10 place-items-center rounded-full bg-white text-2xl ring-1 ring-ink/10" aria-label="Fermer">×</button>
              </div>
              <div className="mt-6 grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="label">Titre * <span className="font-normal">(idéalement avec un mot-clé : « atelier bébé La Seyne-sur-Mer »…)</span></label>
                  <input className="field text-lg font-bold" value={edit.title} onChange={(e) => set("title", e.target.value)} />
                </div>
                <div>
                  <label className="label">Date</label>
                  <input type="date" className="field" value={edit.date.slice(0, 10)} onChange={(e) => set("date", e.target.value)} />
                </div>
                <div>
                  <label className="label">Étiquettes (séparées par des virgules)</label>
                  <input className="field" value={edit.tags.join(", ")} onChange={(e) => set("tags", e.target.value.split(","))} placeholder="Ateliers, Événements" />
                </div>
                <div className="col-span-2">
                  <label className="label">Résumé (affiché dans les listes et sur Google) – {edit.excerpt.length}/160</label>
                  <textarea className="field" rows={2} value={edit.excerpt} onChange={(e) => set("excerpt", e.target.value)} />
                </div>
                <div className="col-span-2">
                  <label className="label">Image de couverture</label>
                  <ImagePicker value={edit.cover} onChange={(v) => set("cover", v)} />
                </div>
                <div className="col-span-2">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="label mb-0 mr-2">Contenu</span>
                    {!preview && (
                      <>
                        <button type="button" className="rounded-lg bg-white px-3 py-1 font-bold ring-1 ring-ink/10" onClick={() => wrap("\n## ", "\n", "Intertitre")}>Titre</button>
                        <button type="button" className="rounded-lg bg-white px-3 py-1 font-bold ring-1 ring-ink/10" onClick={() => wrap("**", "**")}>G</button>
                        <button type="button" className="rounded-lg bg-white px-3 py-1 italic ring-1 ring-ink/10" onClick={() => wrap("*", "*")}>I</button>
                        <button type="button" className="rounded-lg bg-white px-3 py-1 ring-1 ring-ink/10" onClick={() => wrap("\n- ", "", "élément de liste")}>• Liste</button>
                        <button type="button" className="rounded-lg bg-white px-3 py-1 ring-1 ring-ink/10" onClick={() => wrap("[", "](https://)", "lien")}>🔗 Lien</button>
                        <button type="button" className="rounded-lg bg-white px-3 py-1 ring-1 ring-ink/10" onClick={insertImage}>🖼 Image</button>
                      </>
                    )}
                    <button type="button" className="ml-auto rounded-full bg-mustard px-4 py-1 text-sm font-bold" onClick={() => setPreview((p) => !p)}>
                      {preview ? "✏️ Éditer" : "👁 Aperçu"}
                    </button>
                  </div>
                  {preview ? (
                    <div className="prose-ch rounded-2xl bg-white p-6" dangerouslySetInnerHTML={{ __html: marked.parse(edit.content.replace(/</g, "&lt;"), { async: false }) as string }} />
                  ) : (
                    <textarea ref={ta} className="field min-h-[360px] font-mono text-sm" value={edit.content} onChange={(e) => set("content", e.target.value)} placeholder={"Écrivez votre article ici…\n\n## Un intertitre\n\nDu **gras**, une liste :\n- élément 1\n- élément 2"} />
                  )}
                </div>
                <label className="col-span-2 flex items-center gap-2 font-bold">
                  <input type="checkbox" className="h-5 w-5 accent-[#4f7f78]" checked={edit.published} onChange={(e) => set("published", e.target.checked)} /> Publié (décocher = brouillon)
                </label>
                <details className="col-span-2">
                  <summary className="cursor-pointer text-sm font-bold text-ink-soft">Adresse de la page (SEO)</summary>
                  <input className="field mt-2" value={edit.slug} onChange={(e) => set("slug", e.target.value)} placeholder={slugify(edit.title || "mon-article")} />
                </details>
              </div>
              <div className="sticky bottom-0 -mx-5 mt-8 flex gap-3 bg-cream/95 px-5 py-4 backdrop-blur sm:-mx-8 sm:px-8">
                <button onClick={save} disabled={saving} className="btn-primary disabled:opacity-60">{saving ? "Enregistrement…" : "Enregistrer"}</button>
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
