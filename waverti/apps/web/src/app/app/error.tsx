"use client";
import { Button, Callout } from "@waverti/ui";

export default function AppError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4 py-16">
      <Callout tone="danger" title="Cette page n'a pas pu s'afficher" role="alert">
        Un problème est survenu de notre côté. Vos surveillances et vos alertes ne sont pas touchées : Waverti continue de les vérifier.
      </Callout>
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={reset}>Réessayer</Button>
        <a href="/app" className="text-sm font-medium text-blue hover:underline">
          Retour à l'accueil
        </a>
      </div>
    </div>
  );
}
