import type { Metadata } from "next";
import { LegalPage, Todo } from "@/components/marketing/legal-page";

export const metadata: Metadata = { title: "Conditions générales", alternates: { canonical: "/legal/conditions-generales" } };

export default function CgPage() {
  return (
    <LegalPage title="Conditions générales d'utilisation et de vente" updated="29 octobre 2026">
      <h2>1. Objet</h2>
      <p>
        Les présentes conditions régissent l'utilisation du service Waverti édité par LULLIN WEB (<Todo>identité légale</Todo>) et
        la souscription des formules payantes.
      </p>
      <h2>2. Description du service</h2>
      <p>
        Waverti effectue des vérifications automatisées de pages publiques et de résultats de moteurs de recherche, ainsi que des
        contrôles de disponibilité de sites dont l'utilisateur a démontré la propriété. Waverti ne garantit pas l'exhaustivité des
        informations trouvées : il n'explore pas l'intégralité d'Internet et ne consulte pas les pages protégées ou interdites
        aux robots.
      </p>
      <h2>3. Fonctionnement local</h2>
      <p>
        L'application desktop utilise les ressources et la connexion de l'ordinateur de l'utilisateur pour ses propres
        surveillances uniquement, après acceptation explicite. L'utilisateur peut retirer cet accord, fermer ou désinstaller
        l'application à tout moment.
      </p>
      <h2>4. Formules, prix et essai</h2>
      <p>
        Les formules et quotas sont décrits sur la page Tarifs. Les prix sont indiqués TTC. Les formules Plus, Pro et Business
        ouvrent droit à un essai unique de 72 heures, avec enregistrement d'un moyen de paiement via Stripe ; le premier
        prélèvement intervient à la fin de l'essai sauf résiliation préalable. Un rappel est adressé avant ce prélèvement.
      </p>
      <h2>5. Droit de rétractation</h2>
      <p>
        <Todo>Clause de rétractation (14 jours) et conditions de renonciation pour un service commencé à la demande du
        consommateur — à rédiger et valider.</Todo>
      </p>
      <h2>6. Résiliation</h2>
      <p>
        L'abonnement est sans engagement et résiliable en ligne. La résiliation prend effet à la fin de la période en cours ;
        pendant l'essai, elle empêche tout prélèvement. Les changements de formule sont proratisés par Stripe.
      </p>
      <h2>7. Usages interdits</h2>
      <ul>
        <li>Surveiller des réseaux privés, des services internes ou des sites sans autorisation pour les contrôles Business.</li>
        <li>Utiliser Waverti pour surcharger, attaquer ou contourner les protections d'un site.</li>
        <li>Revendre ou automatiser l'accès au service sans accord écrit.</li>
      </ul>
      <p>Tout abus peut entraîner la suspension motivée du compte.</p>
      <h2>8. Responsabilité</h2>
      <p>
        <Todo>Clause de responsabilité et de disponibilité du service — à valider.</Todo>
      </p>
      <h2>9. Médiation et droit applicable</h2>
      <p>
        <Todo>Médiateur de la consommation désigné et ses coordonnées</Todo>. Droit applicable : droit français.
      </p>
    </LegalPage>
  );
}
