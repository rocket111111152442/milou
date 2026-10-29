import type { Metadata } from "next";
import { LegalPage, Todo } from "@/components/marketing/legal-page";

export const metadata: Metadata = { title: "Politique de confidentialité", alternates: { canonical: "/legal/confidentialite" } };

export default function ConfidentialitePage() {
  return (
    <LegalPage title="Politique de confidentialité" updated="29 octobre 2026">
      <h2>Responsable du traitement</h2>
      <p>
        LULLIN WEB, <Todo>identité légale complète, adresse et contact du responsable du traitement</Todo>. Délégué à la protection
        des données, le cas échéant : <Todo>coordonnées du DPO</Todo>.
      </p>
      <h2>Données traitées et finalités</h2>
      <ul>
        <li>Compte : adresse e-mail, nom d'affichage facultatif, préférences — exécution du contrat.</li>
        <li>Surveillances : adresses de pages, sujets de recherche, conditions, résultats des contrôles — exécution du contrat.</li>
        <li>Appareils : nom de l'appareil, système, version de l'application, dates de dernière activité — exécution du contrat et sécurité.</li>
        <li>Facturation : identifiant client et état d'abonnement Stripe. Les données de carte sont traitées exclusivement par Stripe et jamais stockées par Watchly.</li>
        <li>Prévention des essais abusifs : empreinte irréversible (hachée) de l'adresse e-mail et de l'empreinte de carte fournie par Stripe — intérêt légitime.</li>
        <li>Journaux techniques et de sécurité, sans secret ni contenu de page complet — intérêt légitime.</li>
        <li>Assistance : contenu de vos demandes — exécution du contrat / intérêt légitime.</li>
      </ul>
      <h2>Durées de conservation</h2>
      <ul>
        <li>Historique des contrôles : selon votre formule (30, 90 ou 365 jours), puis suppression.</li>
        <li>Mesures de disponibilité Business détaillées : 30 jours ; agrégats journaliers : durée de l'abonnement.</li>
        <li>Captures d'écran d'échec : 30 jours.</li>
        <li>Données de compte : jusqu'à la suppression du compte. Empreintes anti-abus : <Todo>durée à valider (ex. 3 ans)</Todo>.</li>
        <li>Pièces comptables : conservées par Stripe et LULLIN WEB selon les obligations légales (<Todo>durée</Todo>).</li>
      </ul>
      <h2>Destinataires et sous-traitants</h2>
      <p>
        Supabase (authentification, base de données), Vercel (hébergement web), OVHcloud (serveurs de surveillance), Stripe
        (paiement), Resend (e-mails), Brave Search (moteur de recherche : seules les requêtes de recherche sont transmises, sans
        donnée d'identification). <Todo>Vérifier les régions d'hébergement et les garanties de transfert hors UE (clauses
        contractuelles types / DPF) pour chaque sous-traitant.</Todo>
      </p>
      <h2>Mutualisation des recherches</h2>
      <p>
        Pour limiter les coûts et le trafic, les résultats publics d'une même recherche ou d'une même page publique peuvent être
        réutilisés pour plusieurs utilisateurs. Vos surveillances, conditions et alertes ne sont jamais communiquées à un autre
        utilisateur.
      </p>
      <h2>Vos droits</h2>
      <p>
        Vous disposez des droits d'accès, de rectification, d'effacement, de limitation, d'opposition et de portabilité. L'export
        de vos données et la suppression de votre compte sont disponibles dans vos paramètres. Pour toute autre demande :
        <Todo>adresse de contact dédiée</Todo>. Vous pouvez introduire une réclamation auprès de la CNIL (www.cnil.fr).
      </p>
    </LegalPage>
  );
}
