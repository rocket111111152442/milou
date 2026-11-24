"use client";
import { useActionState } from "react";
import { saveListing, type FormState } from "@/app/(admin)/admin/(app)/propiedades/actions";

export interface ListingFormValues {
  id?: number;
  title: string;
  operation: string;
  categoryId: number | null;
  province: string | null;
  city: string | null;
  sector: string | null;
  price: number | null;
  currency: string;
  bedrooms: number | null;
  bathrooms: number | null;
  parking: number | null;
  area: number | null;
  landArea: number | null;
  condition: string | null;
  furnished: boolean | null;
  description: string;
  amenities: string[];
  videoUrl: string | null;
  published: boolean;
  featured: boolean;
}

const v = (x: number | string | null | undefined) => (x === null || x === undefined ? "" : String(x));

export function ListingForm({ initial, categories, cities }: { initial: ListingFormValues; categories: { id: number; name: string }[]; cities: string[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveListing, null);
  return (
    <form action={action} className="space-y-5">
      {initial.id && <input type="hidden" name="id" value={initial.id} />}
      <div>
        <label className="field-label" htmlFor="title">Título *</label>
        <input id="title" name="title" required minLength={5} maxLength={200} defaultValue={initial.title} className="field" placeholder="Villa con piscina y vista al mar en Cabrera" />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="field-label" htmlFor="operation">Operación *</label>
          <select id="operation" name="operation" defaultValue={initial.operation} className="field">
            <option value="sale">Venta</option>
            <option value="rent">Alquiler (precio mensual)</option>
          </select>
        </div>
        <div>
          <label className="field-label" htmlFor="categoryId">Tipo de propiedad</label>
          <select id="categoryId" name="categoryId" defaultValue={v(initial.categoryId)} className="field">
            <option value="">— Elegir —</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="field-label" htmlFor="condition">Estado</label>
          <select id="condition" name="condition" defaultValue={initial.condition ?? ""} className="field">
            <option value="">No indicado</option>
            <option value="ready">Lista para entrega</option>
            <option value="construction">En construcción / pre-venta</option>
          </select>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="field-label" htmlFor="city">Ciudad *</label>
          <input id="city" name="city" required list="cities" defaultValue={v(initial.city)} className="field" placeholder="Cabrera" />
          <datalist id="cities">{cities.map((c) => <option key={c} value={c} />)}</datalist>
        </div>
        <div>
          <label className="field-label" htmlFor="sector">Sector / zona</label>
          <input id="sector" name="sector" defaultValue={v(initial.sector)} className="field" placeholder="La Catalina" />
        </div>
        <div>
          <label className="field-label" htmlFor="province">Provincia</label>
          <input id="province" name="province" defaultValue={initial.province ?? "María Trinidad Sánchez"} className="field" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <label className="field-label" htmlFor="price">Precio (vacío = «precio a consultar»)</label>
          <input id="price" name="price" inputMode="decimal" defaultValue={v(initial.price)} className="field" placeholder="250000" />
        </div>
        <div>
          <label className="field-label" htmlFor="currency">Moneda</label>
          <select id="currency" name="currency" defaultValue={initial.currency} className="field">
            <option value="USD">US$</option>
            <option value="DOP">RD$</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        {([
          ["bedrooms", "Habitaciones", initial.bedrooms],
          ["bathrooms", "Baños", initial.bathrooms],
          ["parking", "Parqueos", initial.parking],
          ["area", "Construcción (m²)", initial.area],
          ["landArea", "Terreno (m²)", initial.landArea],
        ] as const).map(([name, label, val]) => (
          <div key={name}>
            <label className="field-label" htmlFor={name}>{label}</label>
            <input id={name} name={name} inputMode="decimal" defaultValue={v(val)} className="field" />
          </div>
        ))}
      </div>
      <div>
        <label className="field-label" htmlFor="furnished">Amueblada</label>
        <select id="furnished" name="furnished" defaultValue={initial.furnished === null ? "" : initial.furnished ? "yes" : "no"} className="field max-w-xs">
          <option value="">No indicado</option>
          <option value="yes">Sí</option>
          <option value="no">No</option>
        </select>
      </div>
      <div>
        <label className="field-label" htmlFor="description">Descripción (una línea vacía separa los párrafos)</label>
        <textarea id="description" name="description" rows={8} maxLength={10000} defaultValue={initial.description} className="field" />
      </div>
      <div>
        <label className="field-label" htmlFor="amenities">Características (una por línea o separadas por comas)</label>
        <textarea id="amenities" name="amenities" rows={3} defaultValue={initial.amenities.join("\n")} className="field" placeholder={"Piscina\nVista al mar\nPlanta eléctrica"} />
      </div>
      <div>
        <label className="field-label" htmlFor="videoUrl">Enlace de video (YouTube, opcional)</label>
        <input id="videoUrl" name="videoUrl" type="url" defaultValue={v(initial.videoUrl)} className="field" />
      </div>
      <div className="flex flex-wrap gap-6 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" name="published" defaultChecked={initial.published} /> Publicada en el sitio</label>
        <label className="flex items-center gap-2"><input type="checkbox" name="featured" defaultChecked={initial.featured} /> Destacada</label>
      </div>
      {state?.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
      {state?.ok && <p role="status" className="text-sm text-emerald-800">Guardado. El sitio se actualiza en menos de un minuto.</p>}
      <button className="btn-primary" disabled={pending}>{pending ? "Guardando…" : initial.id ? "Guardar cambios" : "Crear y añadir fotos"}</button>
    </form>
  );
}
