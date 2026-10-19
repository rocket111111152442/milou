"use client";

import { useActionState } from "react";
import { studioLogin } from "./actions";

export function StudioLogin() {
  const [error, action, pending] = useActionState(studioLogin, null);
  return (
    <section className="grid min-h-screen place-items-center bg-farine px-6 py-24">
      <form action={action} className="w-full max-w-md rounded-[2rem] bg-creme p-8 ring-1 ring-mie sm:p-10">
        <p className="font-script text-2xl text-caramel">Générateur de sites</p>
        <h1 className="font-display text-4xl tracking-tight">Studio</h1>
        <label htmlFor="password" className="mb-1.5 mt-8 block text-sm font-semibold">
          Mot de passe
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          autoFocus
          className="h-12 w-full rounded-2xl border border-mie bg-farine px-4 outline-none transition focus:border-croute focus:ring-4 focus:ring-croute/10"
        />
        {error && (
          <p className="mt-3 text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
        <button type="submit" disabled={pending} className="mt-6 inline-flex h-12 w-full items-center justify-center rounded-full bg-cafe font-semibold text-creme transition hover:bg-croute disabled:opacity-60">
          {pending ? "Connexion…" : "Se connecter"}
        </button>
      </form>
    </section>
  );
}
