import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@waverti/ui";
import { HybridSection } from "@/components/marketing/sections";

export const metadata: Metadata = {
  title: "Fonctionnement de Waverti",
  description:
    "Où sont faits les contrôles (serveurs de Waverti, application installée, téléphone), ressources utilisées, accord préalable, arrêt et désinstallation.",
  alternates: { canonical: "/fonctionnement" },
};

/** Page d'explication détaillée : le fonctionnement local y est décrit sans être mis en avant sur l'accueil. */
export default function HowWavertiWorksPage() {
  return (
    <>
      <Container className="max-w-3xl pt-20">
        <h1 className="font-display text-4xl font-bold tracking-tight">Fonctionnement de Waverti</h1>
        <div className="mt-8 flex flex-col gap-5 leading-relaxed text-ink-soft">
          <h2 className="font-display text-2xl font-semibold text-ink">Où sont faits les contrôles ?</h2>
          <ul className="list-disc space-y-2 pl-6">
            <li>
              <strong>Serveurs de Waverti</strong> : recherches sur Internet, surveillance des sites professionnels (Business) et
              relais des surveillances de pages lorsque votre ordinateur n'est pas disponible. Les clés des services utilisés
              (moteur de recherche, e-mails) restent sur ces serveurs.
            </li>
            <li>
              <strong>Application installée (Windows, macOS, Linux), facultative</strong> : si vous l'acceptez, elle vérifie vos
              propres surveillances de pages avec votre connexion. Elle ne travaille jamais pour un autre utilisateur.
            </li>
            <li>
              <strong>Téléphone (site installé sur l'écran d'accueil)</strong> : consultation des alertes et réglages
              uniquement. Aucun contrôle n'est exécuté sur le téléphone.
            </li>
          </ul>
          <h2 className="mt-4 font-display text-2xl font-semibold text-ink">Votre accord et votre contrôle</h2>
          <ul className="list-disc space-y-2 pl-6">
            <li>Le fonctionnement local est désactivé tant que vous ne l'avez pas accepté explicitement dans l'application ; l'accord est horodaté.</li>
            <li>L'icône de Waverti reste visible tant que l'application fonctionne, avec l'indication de l'activité en cours.</li>
            <li>Vous pouvez mettre en pause, retirer votre accord, quitter ou désinstaller l'application à tout moment ; vos surveillances sont alors reprises par les serveurs selon votre formule.</li>
            <li>Le démarrage automatique avec l'ordinateur est un choix séparé, désactivé par défaut.</li>
            <li>L'application ne peut ni modifier votre abonnement ni accéder à vos moyens de paiement.</li>
          </ul>
          <p>
            Les conditions détaillées figurent dans les <Link className="text-blue underline underline-offset-4" href="/legal/conditions-generales">conditions générales</Link> (article « Fonctionnement local »).
            Le comportement de notre robot d'exploration est décrit sur la page <Link className="text-blue underline underline-offset-4" href="/robot">WavertiBot</Link>.
          </p>
        </div>
      </Container>
      <HybridSection />
    </>
  );
}
