"use client";
import { Button, Callout } from "@waverti/ui";

export default function AppError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4 py-16">
      <Callout tone="danger" title="Cette page n'a pas pu être chargée" role="alert">
        Une erreur est survenue. Vos données ne sont pas affectées. Réessayez dans un instant.
      </Callout>
      <Button onClick={reset} className="self-start">
        Réessayer
      </Button>
    </div>
  );
}
