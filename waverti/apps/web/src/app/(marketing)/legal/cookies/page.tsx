import type { Metadata } from "next";
import { LegalPage } from "@/components/marketing/legal-page";

export const metadata: Metadata = { title: "Cookies", alternates: { canonical: "/legal/cookies" } };

export default function CookiesPage() {
  return (
    <LegalPage title="Cookies et traceurs" updated="29 octobre 2026">
      <p>
        Waverti n'utilise <strong>aucun cookie publicitaire ni de mesure d'audience tierce</strong>. Les seuls cookies déposés sont
        strictement nécessaires au fonctionnement du service et ne requièrent donc pas de consentement préalable (article 82 de
        la loi Informatique et Libertés, lignes directrices de la CNIL) :
      </p>
      <ul>
        <li>Cookie de session d'authentification (waverti_session, strictement nécessaire) : maintien de votre connexion, 30 jours glissants au maximum, supprimé à la déconnexion.</li>
        <li>Préférences d'interface éventuellement stockées localement dans votre navigateur.</li>
      </ul>
      <p>
        Le paiement est réalisé sur les pages hébergées par Stripe, qui applique sa propre politique en matière de cookies. Si un
        outil de mesure d'audience était ajouté à l'avenir, un bandeau de consentement serait mis en place avant tout dépôt.
      </p>
    </LegalPage>
  );
}
