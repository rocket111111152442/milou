"use client";
import { useActionState } from "react";
import { changePassword, type ActionState } from "@/app/(admin)/admin/actions";

export function PasswordForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(changePassword, null);
  return (
    <form action={action} className="space-y-3">
      <div>
        <label className="field-label" htmlFor="current">Contraseña actual</label>
        <input id="current" name="current" type="password" autoComplete="current-password" required className="field" />
      </div>
      <div>
        <label className="field-label" htmlFor="next">Nueva contraseña (mínimo 12 caracteres)</label>
        <input id="next" name="next" type="password" autoComplete="new-password" minLength={12} required className="field" />
      </div>
      <div>
        <label className="field-label" htmlFor="confirm">Repite la nueva contraseña</label>
        <input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={12} required className="field" />
      </div>
      {state?.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
      {state?.ok && <p role="status" className="text-sm text-emerald-800">Contraseña cambiada.</p>}
      <button className="btn-primary" disabled={pending}>{pending ? "Guardando…" : "Cambiar contraseña"}</button>
    </form>
  );
}
