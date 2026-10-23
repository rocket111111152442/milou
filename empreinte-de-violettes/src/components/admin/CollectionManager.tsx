"use client";

import { motion } from "framer-motion";
import { Copy, Loader2, Plus, Search, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import {
  api,
  ColorsField,
  confirmAction,
  Drawer,
  Empty,
  ImageField,
  ImagesField,
  MoneyField,
  MultiSelect,
  NumberField,
  PageHeader,
  Select,
  TagsField,
  TextArea,
  TextField,
  toast,
  Toggle,
} from "./ui";

export type FieldDef =
  | { key: string; label: string; type: "text" | "textarea" | "date" | "email"; help?: string; span?: 2; rows?: number; required?: boolean }
  | { key: string; label: string; type: "number"; help?: string; span?: 2; nullable?: boolean; step?: number }
  | { key: string; label: string; type: "money"; help?: string; span?: 2; nullable?: boolean }
  | { key: string; label: string; type: "toggle"; help?: string; span?: 2 }
  | { key: string; label: string; type: "select"; options: { value: string; label: string }[]; help?: string; span?: 2 }
  | { key: string; label: string; type: "multiselect"; options: { value: string; label: string }[]; span?: 2 }
  | { key: string; label: string; type: "image"; help?: string; span?: 2 }
  | { key: string; label: string; type: "images"; help?: string; span?: 2; max?: number }
  | { key: string; label: string; type: "tags"; help?: string; span?: 2 }
  | { key: string; label: string; type: "colors"; span?: 2 }
  | { key: string; label: string; type: "custom"; span?: 2; render: (value: unknown, set: (v: unknown) => void, item: Record<string, unknown>) => React.ReactNode }
  | { type: "section"; label: string; key?: string; span?: 2 };

export interface Column<T> {
  label: string;
  render: (item: T) => React.ReactNode;
  className?: string;
}

type Item = { id: string } & Record<string, unknown>;

export function CollectionManager<T extends Item>({
  collection,
  title,
  subtitle,
  singular,
  items: initial,
  columns,
  fields,
  defaults,
  searchKeys = [],
  sort,
  toggleKey = "active",
  canCreate = true,
  filters,
  extraActions,
}: {
  collection: string;
  title: string;
  subtitle?: string;
  singular: string;
  items: T[];
  columns: Column<T>[];
  fields: FieldDef[];
  defaults: Partial<T>;
  searchKeys?: string[];
  sort?: (a: T, b: T) => number;
  toggleKey?: string | null;
  canCreate?: boolean;
  filters?: { label: string; options: { value: string; label: string }[]; test: (item: T, value: string) => boolean };
  extraActions?: React.ReactNode;
}) {
  const router = useRouter();
  const [items, setItems] = useState<T[]>(initial);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("");
  const [editing, setEditing] = useState<Partial<T> | null>(null);
  const [saving, setSaving] = useState(false);

  const list = useMemo(() => {
    const n = q.trim().toLowerCase();
    const out = items.filter(
      (it) =>
        (!n || searchKeys.some((k) => String(it[k] ?? "").toLowerCase().includes(n))) &&
        (!filter || !filters || filters.test(it, filter)),
    );
    return sort ? [...out].sort(sort) : out;
  }, [items, q, filter, filters, searchKeys, sort]);

  const set = (key: string, v: unknown) => setEditing((e) => (e ? ({ ...e, [key]: v } as Partial<T>) : e));

  async function save() {
    if (!editing) return;
    setSaving(true);
    try {
      const isNew = !editing.id;
      const { item } = await api<{ item: T }>(isNew ? `/api/admin/c/${collection}` : `/api/admin/c/${collection}/${editing.id}`, { method: isNew ? "POST" : "PUT", body: editing });
      setItems((list) => (isNew ? [item, ...list] : list.map((x) => (x.id === item.id ? item : x))));
      setEditing(null);
      toast.ok(isNew ? `${singular} créé(e)` : "Modifications enregistrées");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    }
    setSaving(false);
  }

  async function remove(item: Partial<T>) {
    if (!item.id || !confirmAction(`Supprimer définitivement « ${String(item.name ?? item.question ?? item.code ?? item.author ?? item.caption ?? item.email ?? item.id)} » ?`)) return;
    try {
      await api(`/api/admin/c/${collection}/${item.id}`, { method: "DELETE" });
      setItems((l) => l.filter((x) => x.id !== item.id));
      setEditing(null);
      toast.ok("Supprimé");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    }
  }

  async function quickToggle(item: T) {
    if (!toggleKey) return;
    const next = { ...item, [toggleKey]: !item[toggleKey] };
    setItems((l) => l.map((x) => (x.id === item.id ? next : x)));
    try {
      await api(`/api/admin/c/${collection}/${item.id}`, { method: "PUT", body: next });
      router.refresh();
    } catch (e) {
      setItems((l) => l.map((x) => (x.id === item.id ? item : x)));
      toast.error(e instanceof Error ? e.message : "Erreur");
    }
  }

  const renderField = (f: FieldDef, i: number) => {
    if (f.type === "section")
      return (
        <p key={`s${i}`} className="col-span-2 mt-3 border-t border-noir/[0.07] pt-5 text-xs font-semibold uppercase tracking-[0.18em] text-aubergine-600">
          {f.label}
        </p>
      );
    const v = (editing as Record<string, unknown>)?.[f.key];
    const span = f.span === 2 ? "col-span-2" : "col-span-2 sm:col-span-1";
    switch (f.type) {
      case "text":
      case "email":
      case "date":
        return <TextField key={f.key} className={span} label={f.label} help={f.help} type={f.type} required={f.required} value={(v as string) ?? ""} onChange={(x) => set(f.key, x)} />;
      case "textarea":
        return <TextArea key={f.key} className="col-span-2" label={f.label} help={f.help} rows={f.rows} value={(v as string) ?? ""} onChange={(x) => set(f.key, x)} />;
      case "number":
        return <NumberField key={f.key} className={span} label={f.label} help={f.help} step={f.step} nullable={f.nullable} value={(v as number | null) ?? (f.nullable ? null : 0)} onChange={(x) => set(f.key, x)} />;
      case "money":
        return <MoneyField key={f.key} className={span} label={f.label} help={f.help} nullable={f.nullable} value={(v as number | null) ?? (f.nullable ? null : 0)} onChange={(x) => set(f.key, x)} />;
      case "toggle":
        return (
          <div key={f.key} className={span}>
            <Toggle label={f.label} help={f.help} checked={!!v} onChange={(x) => set(f.key, x)} />
          </div>
        );
      case "select":
        return <Select key={f.key} className={span} label={f.label} help={f.help} value={(v as string) ?? ""} onChange={(x) => set(f.key, x)} options={f.options} />;
      case "multiselect":
        return <MultiSelect key={f.key} className="col-span-2" label={f.label} value={(v as string[]) ?? []} onChange={(x) => set(f.key, x)} options={f.options} />;
      case "image":
        return (
          <div key={f.key} className="col-span-2">
            <ImageField label={f.label} help={f.help} value={(v as string) ?? ""} onChange={(x) => set(f.key, x)} />
          </div>
        );
      case "images":
        return (
          <div key={f.key} className="col-span-2">
            <ImagesField label={f.label} help={f.help} max={f.max} value={(v as string[]) ?? []} onChange={(x) => set(f.key, x)} />
          </div>
        );
      case "tags":
        return <TagsField key={f.key} className="col-span-2" label={f.label} help={f.help} value={(v as string[]) ?? []} onChange={(x) => set(f.key, x)} />;
      case "colors":
        return (
          <div key={f.key} className="col-span-2">
            <ColorsField label={f.label} value={(v as string[]) ?? []} onChange={(x) => set(f.key, x)} />
          </div>
        );
      case "custom":
        return (
          <div key={f.key} className="col-span-2">
            {f.render(v, (x) => set(f.key, x), editing as Record<string, unknown>)}
          </div>
        );
    }
  };

  return (
    <div>
      <PageHeader
        title={title}
        subtitle={subtitle || `${items.length} élément${items.length > 1 ? "s" : ""}`}
        actions={
          <>
            {extraActions}
            {canCreate && (
              <button onClick={() => setEditing({ ...defaults } as Partial<T>)} className="adm-btn adm-btn-primary">
                <Plus className="h-4 w-4" /> {`Ajouter ${singular.toLowerCase()}`}
              </button>
            )}
          </>
        }
      />
      <div className="adm-card overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-noir/[0.06] p-4">
          {searchKeys.length > 0 && (
            <div className="relative min-w-[220px] flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-noir/35" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher…" className="adm-input pl-9" />
            </div>
          )}
          {filters && (
            <select value={filter} onChange={(e) => setFilter(e.target.value)} className="adm-input w-auto">
              <option value="">{filters.label}</option>
              {filters.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          )}
          <span className="ml-auto text-xs text-noir/45">{list.length} affiché(s)</span>
        </div>
        {list.length === 0 ? (
          <div className="p-6">
            <Empty text="Rien à afficher pour le moment." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-noir/[0.06] text-left text-[0.68rem] uppercase tracking-wider text-noir/45">
                  {columns.map((c) => (
                    <th key={c.label} className={cn("px-4 py-3 font-medium", c.className)}>
                      {c.label}
                    </th>
                  ))}
                  {toggleKey && <th className="px-4 py-3 font-medium">Visible</th>}
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {list.map((it, i) => (
                  <motion.tr
                    key={it.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i, 20) * 0.015 }}
                    onClick={() => setEditing({ ...it })}
                    className="cursor-pointer border-b border-noir/[0.04] transition hover:bg-aubergine-50/60"
                  >
                    {columns.map((c) => (
                      <td key={c.label} className={cn("px-4 py-3 align-middle", c.className)}>
                        {c.render(it)}
                      </td>
                    ))}
                    {toggleKey && (
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <button
                          role="switch"
                          aria-checked={!!it[toggleKey]}
                          onClick={() => quickToggle(it)}
                          className={cn("relative h-5 w-9 rounded-full transition", it[toggleKey] ? "bg-aubergine-600" : "bg-noir/15")}
                          aria-label="Activer / désactiver"
                        >
                          <span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all", it[toggleKey] ? "left-[18px]" : "left-0.5")} />
                        </button>
                      </td>
                    )}
                    <td className="px-2 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => remove(it)} className="rounded-lg p-1.5 text-noir/30 hover:bg-red-50 hover:text-red-600" aria-label="Supprimer">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Drawer
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.id ? `Modifier ${singular.toLowerCase()}` : `Nouveau · ${singular.toLowerCase()}`}
        wide={fields.length > 10}
        footer={
          <>
            <div className="flex gap-2">
              {editing?.id && (
                <>
                  <button onClick={() => remove(editing)} className="adm-btn adm-btn-danger">
                    <Trash2 className="h-4 w-4" /> Supprimer
                  </button>
                  {canCreate && (
                    <button
                      onClick={() => {
                        const { id: _id, ...rest } = editing as Item;
                        void _id;
                        setEditing({ ...(rest as Partial<T>), ...("name" in rest ? { name: `${rest.name} (copie)`, slug: "" } : {}) } as Partial<T>);
                      }}
                      className="adm-btn adm-btn-ghost"
                    >
                      <Copy className="h-4 w-4" /> Dupliquer
                    </button>
                  )}
                </>
              )}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setEditing(null)} className="adm-btn adm-btn-ghost">
                Annuler
              </button>
              <button onClick={save} disabled={saving} className="adm-btn adm-btn-primary">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />} Enregistrer
              </button>
            </div>
          </>
        }
      >
        {editing && <div className="grid grid-cols-2 gap-4">{fields.map(renderField)}</div>}
      </Drawer>
    </div>
  );
}
