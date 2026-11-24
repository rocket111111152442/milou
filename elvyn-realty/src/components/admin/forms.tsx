"use client";
import { useActionState, useEffect, useRef } from "react";
import { PIPELINE, TEMPERATURES } from "@/config/crm";
import { addNote, confirmVisit, updateContact, type ActionState } from "@/app/(admin)/admin/actions";

function Feedback({ state }: { state: ActionState }) {
  if (!state) return null;
  if (state.error) return <p role="alert" className="rounded-lg bg-red-50 p-2.5 text-sm text-red-800">{state.error}</p>;
  if (state.ok) return <p role="status" className="rounded-lg bg-emerald-50 p-2.5 text-sm text-emerald-900">Guardado.</p>;
  return null;
}

const toLocalInput = (d: Date | string | null) => {
  if (!d) return "";
  // Shown in Dominican Republic time (UTC-4, no DST), like the rest of the CRM.
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santo_Domingo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(new Date(d))
      .map((x) => [x.type, x.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
};

export interface EditableContact {
  id: number; fullName: string; email: string | null; phone: string | null; country: string | null; city: string | null; language: string | null; birthDate: string | null;
  status: string; temperature: string; temperatureReason: string | null; priority: boolean; nextAction: string | null; nextActionAt: Date | string | null; summary: string | null;
}

export function ContactEditForm({ c }: { c: EditableContact }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(updateContact, null);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="id" value={c.id} />
      <Feedback state={state} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label className="field-label" htmlFor="fullName">Nombre</label><input id="fullName" name="fullName" defaultValue={c.fullName} className="field" required /></div>
        <div><label className="field-label" htmlFor="phone">Teléfono / WhatsApp</label><input id="phone" name="phone" defaultValue={c.phone ?? ""} className="field" /></div>
        <div><label className="field-label" htmlFor="email">Correo</label><input id="email" name="email" type="email" defaultValue={c.email ?? ""} className="field" /></div>
        <div><label className="field-label" htmlFor="country">País</label><input id="country" name="country" defaultValue={c.country ?? ""} className="field" /></div>
        <div><label className="field-label" htmlFor="city">Ciudad</label><input id="city" name="city" defaultValue={c.city ?? ""} className="field" /></div>
        <div><label className="field-label" htmlFor="language">Idioma</label><input id="language" name="language" defaultValue={c.language ?? ""} className="field" /></div>
        <div><label className="field-label" htmlFor="birthDate">Fecha de nacimiento <span className="font-normal text-ink-soft">(opcional)</span></label><input id="birthDate" name="birthDate" type="date" defaultValue={c.birthDate ?? ""} className="field" /></div>
        <div><label className="field-label" htmlFor="status">Estado</label><select id="status" name="status" defaultValue={c.status} className="field">{PIPELINE.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}</select></div>
        <div><label className="field-label" htmlFor="temperature">Nivel de interés</label><select id="temperature" name="temperature" defaultValue={c.temperature} className="field">{TEMPERATURES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}</select></div>
        <div className="flex items-end"><label className="flex min-h-[44px] items-center gap-2 text-sm"><input type="checkbox" name="priority" defaultChecked={c.priority} className="h-4 w-4 accent-[#EB6500]" /> Prioritario</label></div>
      </div>
      <div><label className="field-label" htmlFor="temperatureReason">Justificación del nivel</label><textarea id="temperatureReason" name="temperatureReason" defaultValue={c.temperatureReason ?? ""} rows={2} className="field" /></div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label className="field-label" htmlFor="nextAction">Próxima acción</label><input id="nextAction" name="nextAction" defaultValue={c.nextAction ?? ""} className="field" placeholder="Llamar, enviar fichas…" /></div>
        <div><label className="field-label" htmlFor="nextActionAt">Fecha de seguimiento (hora de RD)</label><input id="nextActionAt" name="nextActionAt" type="datetime-local" defaultValue={toLocalInput(c.nextActionAt)} className="field" /></div>
      </div>
      <div><label className="field-label" htmlFor="summary">Resumen</label><textarea id="summary" name="summary" defaultValue={c.summary ?? ""} rows={3} className="field" /></div>
      <button className="btn-dark" disabled={pending}>{pending ? "Guardando…" : "Guardar cambios"}</button>
    </form>
  );
}

export function NoteForm({ contactId }: { contactId: number }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(addNote, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);
  return (
    <form ref={ref} action={action} className="space-y-2">
      <input type="hidden" name="contactId" value={contactId} />
      <label className="sr-only" htmlFor="note">Nueva nota interna</label>
      <textarea id="note" name="body" rows={3} className="field" placeholder="Nota interna (no visible para el cliente)" />
      {state?.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
      <button className="btn-outline min-h-[40px]" disabled={pending}>Añadir nota</button>
    </form>
  );
}

export function ConfirmVisitForm({ appointmentId, virtual, meetingUrl }: { appointmentId: number; virtual: boolean; meetingUrl: string | null }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(confirmVisit, null);
  return (
    <form action={action} className="mt-3 grid gap-2 rounded-xl bg-navy-50 p-3 sm:grid-cols-[1fr_110px_auto] sm:items-end">
      <input type="hidden" name="appointmentId" value={appointmentId} />
      <input type="hidden" name="tzOffset" value="-04:00" />
      <div><label className="text-xs font-medium" htmlFor={`st-${appointmentId}`}>Fecha y hora (hora de RD)</label><input id={`st-${appointmentId}`} name="startsAt" type="datetime-local" className="field min-h-[40px] py-1.5" required /></div>
      <div><label className="text-xs font-medium" htmlFor={`du-${appointmentId}`}>Duración (min)</label><input id={`du-${appointmentId}`} name="duration" type="number" min={15} max={480} defaultValue={60} className="field min-h-[40px] py-1.5" /></div>
      <button className="btn-dark min-h-[40px]" disabled={pending}>Confirmar</button>
      {virtual && (
        <div className="sm:col-span-3"><label className="text-xs font-medium" htmlFor={`mu-${appointmentId}`}>Enlace de videollamada (https://…)</label><input id={`mu-${appointmentId}`} name="meetingUrl" defaultValue={meetingUrl ?? ""} className="field min-h-[40px] py-1.5" placeholder="Pegar el enlace de Zoom, Meet, WhatsApp…" /></div>
      )}
      <div className="sm:col-span-3"><Feedback state={state} /></div>
    </form>
  );
}
