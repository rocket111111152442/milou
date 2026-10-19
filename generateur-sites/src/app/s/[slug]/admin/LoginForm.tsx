"use client";

import { useActionState } from "react";
import { Monogram } from "@/components/ui/Logo";
import { useSiteData } from "@/components/SettingsProvider";
import { login } from "./actions";

export function LoginForm() {
  const [error, action, pending] = useActionState(login, null);
  const { slug, site } = useSiteData();
  return (
    <form action={action}>
      <input type="hidden" name="slug" value={slug} />
      <Monogram className="h-12 w-12 text-croute" />
      <h1 className="mt-5 font-display text-4xl tracking-tight">Espace commandes</h1>
      <p className="mt-2 text-sm text-cafe/70">Réservé à {site.name}.</p>
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
      <button
        type="submit"
        disabled={pending}
        className="mt-6 inline-flex h-12 w-full items-center justify-center rounded-full bg-cafe font-semibold text-creme transition hover:bg-croute disabled:opacity-60"
      >
        {pending ? "Connexion…" : "Se connecter"}
      </button>
    </form>
  );
}
