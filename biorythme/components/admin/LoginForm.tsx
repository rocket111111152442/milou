"use client";

import { useActionState } from "react";
import { loginAction } from "@/app/admin/actions";

export default function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, undefined);
  return (
    <form action={action} className="mt-8 grid gap-3">
      <label className="block">
        <span className="mb-1.5 block text-xs uppercase tracking-[0.15em] text-muted">Mot de passe</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          autoFocus
          className="w-full rounded-2xl border border-line bg-surface px-4 py-3.5 outline-none focus:border-volt"
        />
      </label>
      {state?.error && <p className="text-sm text-blaze">{state.error}</p>}
      <button disabled={pending} className="rounded-full bg-volt py-4 font-semibold text-ink disabled:opacity-60">
        {pending ? "Connexion…" : "Se connecter"}
      </button>
    </form>
  );
}
