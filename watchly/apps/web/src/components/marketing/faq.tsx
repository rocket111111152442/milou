import { Accordion, AccordionItem, Container, SectionHeading } from "@watchly/ui";

export const faqItems: Array<{ q: string; a: string }> = [
  {
    q: "Comment fonctionne Watchly ?",
    a: "Vous indiquez une page ou un sujet et une condition (un prix sous un seuil, un retour en stock, une annonce officielle…). Watchly effectue les vérifications à intervalles réguliers, compare chaque résultat au précédent et vous envoie une notification uniquement quand la condition est remplie.",
  },
  {
    q: "Comment installer l'application ?",
    a: "Téléchargez l'installateur correspondant à votre système (Windows, macOS ou Linux) depuis la page Téléchargements, puis reliez l'application à votre compte grâce au code affiché à l'écran. Les téléchargements ne sont proposés que lorsqu'une version testée est disponible ; en attendant, vous pouvez utiliser la version navigateur.",
  },
  {
    q: "Qu'est-ce qu'une recherche locale ?",
    a: "Une vérification effectuée par l'application installée sur votre ordinateur, avec votre connexion Internet. Elle ne concerne que vos propres surveillances : votre ordinateur n'est jamais utilisé pour le compte d'un autre utilisateur. Ce fonctionnement doit être accepté explicitement avant activation.",
  },
  {
    q: "Quelles ressources de mon ordinateur sont utilisées ?",
    a: "Très peu et de façon ponctuelle : au maximum deux contrôles simultanés, chacun téléchargeant une page limitée à 2 Mo puis l'analysant quelques instants. L'activité est toujours visible et vous pouvez mettre en pause, fermer ou désinstaller l'application à tout moment.",
  },
  {
    q: "Que se passe-t-il quand mon PC est éteint ?",
    a: "Avec les formules Plus, Pro et Business, les serveurs Watchly reprennent automatiquement les contrôles éligibles, sans doublon. Avec la formule Découverte, les contrôles sont suspendus et reprennent au prochain lancement de l'application. Les contrôles Business sont toujours effectués par nos serveurs.",
  },
  {
    q: "Mes données sont-elles confidentielles ?",
    a: "Vos surveillances ne sont visibles que par vous. Nous collectons le minimum nécessaire (adresse e-mail, surveillances, résultats), ne revendons aucune donnée et appliquons des durées de conservation limitées. Vous pouvez exporter vos données ou supprimer votre compte depuis vos paramètres.",
  },
  {
    q: "Combien coûte Watchly ?",
    a: "La formule Découverte est gratuite. Plus coûte 5,99 € par mois, Pro 14,99 € par mois et Business 39,99 € par mois (14,99 € par site professionnel supplémentaire). Les prix sont indiqués TTC.",
  },
  {
    q: "Comment se passent les paiements ?",
    a: "Les paiements sont gérés par Stripe. Watchly ne voit ni ne stocke jamais votre numéro de carte. Pendant la phase de prévisualisation actuelle, seuls des paiements de test sont possibles : aucun prélèvement réel n'est effectué.",
  },
  {
    q: "Comment fonctionne l'essai gratuit ?",
    a: "Les formules Plus, Pro et Business proposent 72 heures d'essai. Vous enregistrez une carte via Stripe ; l'essai commence immédiatement, avec des limites (3 surveillances, recherche Web limitée, un site professionnel pour Business). Un rappel vous est envoyé avant le premier prélèvement, qui n'a lieu qu'à la fin de l'essai si vous n'avez pas résilié. Un seul essai est possible par personne.",
  },
  {
    q: "Puis-je résilier facilement ?",
    a: "Oui, en deux clics depuis la page Abonnement. Une résiliation pendant l'essai empêche tout prélèvement. Après l'essai, l'abonnement reste actif jusqu'à la fin de la période déjà payée, puis votre compte repasse en formule Découverte.",
  },
  {
    q: "Les recherches sont-elles fiables ?",
    a: "Watchly s'appuie sur un moteur de recherche et sur les pages publiques accessibles. Il ne peut pas explorer tout Internet ni lire les pages protégées. Chaque information est classée (confirmée, probable, rumeur ou aucune information) et accompagnée de sa source : Watchly n'invente jamais une information manquante.",
  },
  {
    q: "Comment fonctionne Watchly Business ?",
    a: "Vous ajoutez votre site et prouvez que vous en êtes responsable (enregistrement DNS ou fichier de vérification). Nos serveurs contrôlent ensuite vos points de contrôle chaque minute, le certificat HTTPS chaque jour et un parcours navigateur toutes les deux heures. Une panne est revérifiée avant l'alerte, et vous êtes prévenu à son rétablissement.",
  },
  {
    q: "Watchly respecte-t-il les sites surveillés ?",
    a: "Oui. Watchly s'identifie clairement, respecte les fichiers robots.txt, espace les requêtes vers un même site et n'effectue aucune action engageante (achat, paiement, envoi de formulaire vers un tiers). Les tests de parcours sont réservés aux sites dont la propriété a été vérifiée.",
  },
];

export function FaqSection() {
  return (
    <section id="faq" aria-labelledby="faq-title" className="py-24 sm:py-32">
      <Container className="grid gap-12 lg:grid-cols-[1fr_1.6fr]">
        <SectionHeading
          id="faq-title"
          align="left"
          eyebrow="Questions fréquentes"
          title="Tout ce que vous voulez savoir"
          description="Une autre question ? Écrivez-nous depuis la page Assistance."
        />
        <Accordion type="single" collapsible className="rounded-2xl border border-line bg-white px-6">
          {faqItems.map((f, i) => (
            <AccordionItem key={f.q} value={`faq-${i}`} question={f.q}>
              {f.a}
            </AccordionItem>
          ))}
        </Accordion>
      </Container>
    </section>
  );
}
