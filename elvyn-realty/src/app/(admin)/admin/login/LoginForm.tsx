"use client";
import { useActionState, useState } from "react";
import { login, type ActionState } from "../actions";

export function LoginForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(login, null);
  const [email, setEmail] = useState(""); // kept after a failed attempt (React resets uncontrolled fields)
  return (
    <form action={action} className="space-y-4">
      {state?.error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{state.error}</p>}
      <div>
        <label htmlFor="email" className="field-label">Correo</label>
        <input id="email" name="email" type="email" autoComplete="username" required className="field" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div>
        <label htmlFor="password" className="field-label">Contraseña</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required className="field" />
      </div>
      <button type="submit" className="btn-dark w-full" disabled={pending}>{pending ? "Entrando…" : "Entrar"}</button>
    </form>
  );
}
