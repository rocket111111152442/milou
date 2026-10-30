import type { Metadata } from "next";
import { Container } from "@waverti/ui";

export const metadata: Metadata = {
  title: "WavertiBot — notre robot",
  description: "Comment WavertiBot accède aux pages publiques, respecte robots.txt et limite sa fréquence de requêtes.",
  alternates: { canonical: "/robot" },
};

export default function RobotPage() {
  return (
    <Container className="max-w-3xl py-20">
      <h1 className="font-display text-4xl font-bold tracking-tight">WavertiBot</h1>
      <div className="mt-8 flex flex-col gap-5 leading-relaxed text-ink-soft">
        <p>
          WavertiBot est le robot qui vérifie les pages publiques demandées par les utilisateurs de Waverti. Il s'identifie avec
          l'en-tête <code className="rounded bg-surface px-1.5 py-0.5 text-sm">User-Agent: WavertiBot/0.1</code>.
        </p>
        <h2 className="mt-4 font-display text-2xl font-semibold text-ink">Nos engagements</h2>
        <ul className="list-disc space-y-2 pl-6">
          <li>Respect des directives robots.txt pour tous les contrôles automatiques, depuis nos serveurs comme depuis l&apos;application installée.</li>
          <li>Espacement des requêtes vers un même site et mise en cache partagée des pages publiques identiques.</li>
          <li>Aucune authentification, aucun contournement de protection, aucune soumission de formulaire sur des sites tiers.</li>
          <li>Les tests de parcours et contrôles à la minute ne visent que des sites dont la propriété a été vérifiée.</li>
        </ul>
        <h2 className="mt-4 font-display text-2xl font-semibold text-ink">Bloquer WavertiBot</h2>
        <pre className="overflow-x-auto rounded-xl bg-surface p-4 text-sm">{`User-agent: WavertiBot\nDisallow: /`}</pre>
        <p>
          Pour signaler un comportement anormal, utilisez la page Assistance (catégorie « Abus »). Les contrôles effectués par
          l'application installée chez un utilisateur passent par sa propre connexion et ne concernent que ses surveillances.
        </p>
      </div>
    </Container>
  );
}
