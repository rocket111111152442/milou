import type { Metadata } from "next";
import { Logo } from "@waverti/ui";
import { RetryButton } from "@/components/pwa/retry-button";

export const metadata: Metadata = { title: "Hors ligne", robots: { index: false } };
export const dynamic = "force-static";

/** Page affichée par l'application installée (PWA) quand le téléphone ou l'ordinateur n'a pas de connexion. */
export default function OfflinePage() {
  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <div className="flex max-w-md flex-col items-center gap-5 text-center">
        <Logo />
        <h1 className="font-display text-2xl font-bold">Vous êtes hors ligne</h1>
        <p className="text-muted-fg">
          Waverti a besoin d'une connexion pour afficher vos surveillances et vos alertes à jour. Vos surveillances
          continuent d'être contrôlées par les serveurs de Waverti pendant ce temps : rien n'est perdu.
        </p>
        <RetryButton />
      </div>
    </main>
  );
}
