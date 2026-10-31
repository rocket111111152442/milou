import type { SeoContent } from "@/components/marketing/seo-page";

export const seoPages: Record<string, SeoContent & { title: string; description: string }> = {
  "surveiller-prix-produit": {
    slug: "surveiller-prix-produit",
    title: "Surveiller le prix d'un produit et être alerté d'une baisse",
    description:
      "Suivez automatiquement le prix d'un produit sur un site marchand et recevez une alerte quand il passe sous votre seuil ou baisse d'un certain pourcentage.",
    eyebrow: "Surveiller un prix",
    h1: "Surveiller le prix d'un produit, sans revenir sur la page chaque jour",
    intro:
      "Vous attendez une baisse de prix avant d'acheter ? Indiquez la page du produit et votre prix cible : Waverti relève le prix à intervalles réguliers et vous prévient dès qu'il passe sous votre seuil.",
    blocks: [
      {
        title: "Comment Waverti lit le prix d'une page",
        body: [
          "Waverti privilégie les informations structurées que la plupart des boutiques publient pour les moteurs de recherche (données produit JSON-LD, microdonnées, balises meta). Quand elles sont absentes, il recherche le prix affiché à proximité du symbole de la devise, ou dans la zone que vous désignez avec un sélecteur CSS.",
          "Chaque relevé indique la source utilisée, pour que vous sachiez d'où vient le chiffre. Si aucun prix fiable n'est trouvé, Waverti vous le signale au lieu de deviner.",
        ],
      },
      {
        title: "Deux règles d'alerte au choix",
        body: ["Selon votre objectif, choisissez la condition la plus adaptée :"],
        list: [
          "Prix sous un seuil : une alerte quand le prix descend sous la somme indiquée, puis plus rien tant qu'il reste dessous.",
          "Baisse de prix : une alerte à chaque baisse, éventuellement au-delà d'un pourcentage minimum (par exemple 10 %).",
        ],
      },
      {
        title: "Limites à connaître",
        body: [
          "Certaines boutiques affichent des prix différents selon la connexion, le pays ou le panier, ou bloquent les robots. Waverti consulte la page publique telle qu'un visiteur non connecté la voit et respecte les restrictions d'accès du site.",
        ],
      },
    ],
    steps: [
      "Copiez l'adresse de la page du produit.",
      "Dans Waverti, créez une surveillance et choisissez « Le prix passe sous un seuil ».",
      "Vérifiez le prix détecté lors du contrôle initial, puis indiquez votre seuil.",
      "Recevez l'alerte dans l'application, par e-mail ou sur votre bureau selon vos préférences.",
    ],
    faqs: [
      {
        q: "À quelle fréquence le prix est-il vérifié ?",
        a: "Toutes les 6 heures en formule Plus et toutes les 2 heures en Pro et Business.",
      },
      {
        q: "Est-ce que je reçois une alerte à chaque contrôle ?",
        a: "Non. Avec la règle de seuil, vous êtes alerté au moment où le prix passe sous le seuil, pas à chaque vérification suivante.",
      },
      {
        q: "Puis-je surveiller un produit sur n'importe quel site ?",
        a: "Sur la plupart des pages publiques, oui. Les pages qui exigent une connexion ou interdisent les robots ne sont pas consultées.",
      },
    ],
    cta: { label: "Essayer gratuitement pendant 3 jours", href: "/tarifs" },
  },
  "alerte-retour-en-stock": {
    slug: "alerte-retour-en-stock",
    title: "Alerte de retour en stock : soyez prévenu dès qu'un produit est disponible",
    description:
      "Recevez une notification dès qu'un produit en rupture redevient disponible. Waverti vérifie la disponibilité affichée et vous alerte au retour en stock.",
    eyebrow: "Alerte retour en stock",
    h1: "Être prévenu dès qu'un produit revient en stock",
    intro:
      "Le produit que vous voulez est en rupture ? Waverti vérifie régulièrement sa disponibilité et vous envoie une alerte au moment où il redevient commandable.",
    blocks: [
      {
        title: "Comment la disponibilité est détectée",
        body: [
          "Waverti lit d'abord l'état de disponibilité déclaré par la boutique dans ses données produit (par exemple « InStock » ou « OutOfStock »). À défaut, il analyse les mentions visibles sur la page comme « en stock », « rupture de stock » ou « indisponible ».",
          "L'alerte part lors du passage de « rupture » à « disponible ». Une précommande est signalée comme telle.",
        ],
      },
      {
        title: "Pourquoi une alerte rapide compte",
        body: [
          "Les réassorts de produits très demandés partent parfois en quelques heures. Avec une formule Pro, la page est vérifiée toutes les 2 heures ; votre ordinateur et nos serveurs se relaient pour ne pas manquer de créneau.",
        ],
      },
    ],
    steps: [
      "Ouvrez la page du produit en rupture et copiez son adresse.",
      "Créez une surveillance avec la condition « Le produit revient en stock ».",
      "Contrôlez l'état détecté lors du contrôle initial (« en rupture »).",
      "Activez les notifications du bureau pour être prévenu immédiatement.",
    ],
    faqs: [
      {
        q: "Waverti peut-il acheter le produit à ma place ?",
        a: "Non. Waverti ne réalise aucun achat ni aucune action engageante : il vous prévient, vous décidez.",
      },
      {
        q: "Que se passe-t-il si la boutique change sa page ?",
        a: "Si la disponibilité ne peut plus être lue, le contrôle est marqué en erreur et vous êtes informé, plutôt que de recevoir une fausse alerte.",
      },
    ],
    cta: { label: "Essayer gratuitement pendant 3 jours", href: "/tarifs" },
  },
  "surveiller-changements-site": {
    slug: "surveiller-changements-site",
    title: "Surveiller les changements d'une page web",
    description:
      "Détectez automatiquement les modifications d'une page web : nouveau texte, contenu supprimé, mise à jour d'une liste. Alertes uniquement pour les changements pertinents.",
    eyebrow: "Changements d'un site",
    h1: "Surveiller les changements d'une page web",
    intro:
      "Règlement mis à jour, nouvelle liste de résultats, page d'annonces, conditions modifiées : Waverti compare la page à chaque contrôle et vous signale ce qui a changé.",
    blocks: [
      {
        title: "Ignorer le bruit, garder l'essentiel",
        body: [
          "Les pages contiennent souvent des éléments qui changent à chaque visite : date du jour, publicités, compteurs. Waverti compare le texte visible normalisé et, en mode « changements significatifs », ignore les variations de moins de 2 % du contenu.",
          "Vous pouvez aussi restreindre la surveillance à une zone précise de la page grâce à un sélecteur CSS, ou suivre l'apparition ou la disparition d'un mot ou d'une phrase.",
        ],
      },
      {
        title: "Un historique consultable",
        body: ["Chaque contrôle est enregistré avec un résumé du changement, l'heure et l'exécutant (votre ordinateur ou nos serveurs)."],
      },
    ],
    steps: [
      "Indiquez l'adresse de la page à suivre.",
      "Choisissez « La page est modifiée » ou « Un texte apparaît / disparaît ».",
      "Facultatif : limitez la surveillance à une zone avec un sélecteur CSS.",
      "Consultez le résumé des changements dans l'historique de la surveillance.",
    ],
    faqs: [
      {
        q: "Waverti conserve-t-il une copie complète de la page ?",
        a: "Non. Seuls une empreinte du texte et un extrait limité sont conservés, le temps nécessaire à la comparaison et à l'historique de votre formule.",
      },
      {
        q: "Puis-je surveiller une page qui demande une connexion ?",
        a: "Non. Waverti ne consulte que des pages publiques, sans identifiant.",
      },
    ],
    cta: { label: "Essayer gratuitement pendant 3 jours", href: "/tarifs" },
  },
  "detecter-panne-site-internet": {
    slug: "detecter-panne-site-internet",
    title: "Détecter une panne de site internet et être alerté",
    description:
      "Surveillez la disponibilité de votre site chaque minute. Pannes confirmées avant alerte, notification de rétablissement et historique des incidents.",
    eyebrow: "Détecter une panne",
    h1: "Détecter la panne de votre site internet avant vos clients",
    intro:
      "Une panne de quelques minutes peut coûter des ventes et de la confiance. Waverti Business vérifie votre site chaque minute depuis ses serveurs et vous alerte dès qu'un problème est confirmé.",
    blocks: [
      {
        title: "Ce qui est contrôlé",
        body: ["Pour chacun de vos points de contrôle, Waverti vérifie :"],
        list: [
          "que le serveur répond dans le délai fixé ;",
          "que le code HTTP correspond à celui attendu (par exemple 200) ;",
          "qu'un mot-clé attendu est bien présent dans la page, pour repérer les pages d'erreur « qui répondent 200 » ;",
          "le temps de réponse, pour repérer les ralentissements.",
        ],
      },
      {
        title: "Pas de fausse alerte pour une micro-coupure",
        body: [
          "Lorsqu'un contrôle échoue, Waverti le revérifie avant d'ouvrir un incident. Vous êtes alerté seulement si la panne est confirmée, puis à nouveau quand le site est rétabli, avec la durée de l'incident.",
        ],
      },
    ],
    steps: [
      "Ajoutez votre site et vérifiez sa propriété (DNS ou fichier).",
      "Déclarez jusqu'à 3 points de contrôle : accueil, page produit, page de contact…",
      "Indiquez le code HTTP et, si besoin, le mot-clé attendus.",
      "Recevez les alertes prioritaires par e-mail et dans l'application.",
    ],
    faqs: [
      {
        q: "Les contrôles dépendent-ils de mon ordinateur ?",
        a: "Non. Les contrôles Business sont toujours exécutés par les serveurs Waverti, que votre ordinateur soit allumé ou non.",
      },
      {
        q: "Pourquoi dois-je prouver que le site m'appartient ?",
        a: "Des contrôles à la minute et des tests de parcours ne doivent viser que des sites dont vous êtes responsable : c'est une protection pour les sites tiers.",
      },
    ],
    cta: { label: "Essayer Business gratuitement pendant 3 jours", href: "/inscription?formule=business" },
  },
  "surveillance-site-entreprise": {
    slug: "surveillance-site-entreprise",
    title: "Surveillance de site pour les entreprises : disponibilité, formulaires, HTTPS",
    description:
      "Waverti Business surveille la disponibilité, les formulaires, les parcours et le certificat HTTPS de votre site professionnel, avec rapports d'incidents.",
    eyebrow: "Surveillance pour entreprises",
    h1: "La surveillance de site pensée pour les petites et moyennes entreprises",
    intro:
      "Waverti Business réunit dans un tableau de bord simple ce dont un site professionnel a besoin : disponibilité minute par minute, tests de formulaires et de parcours, certificat HTTPS et historique des incidents.",
    blocks: [
      {
        title: "Tester ce que font vraiment vos visiteurs",
        body: [
          "Un site peut répondre tout en étant cassé : bouton inactif, formulaire en erreur, page de résultats vide. Le scénario navigateur rejoue un parcours (navigation, saisie, vérification d'un texte ou d'une adresse) toutes les 2 heures et conserve une capture en cas d'échec.",
          "Par sécurité, les scénarios ne valident ni achat ni paiement, et bloquent les envois de données vers d'autres domaines que le vôtre.",
        ],
      },
      {
        title: "Des rapports clairs",
        body: [
          "Disponibilité sur 30 jours, temps de réponse moyen, durée et cause de chaque incident : les rapports s'appuient uniquement sur les mesures réellement effectuées. Une période sans mesure est affichée comme « donnée indisponible ».",
        ],
      },
      {
        title: "Un site professionnel inclus",
        body: ["La formule Business couvre un site professionnel, avec ses trois points de contrôle, son scénario navigateur et la surveillance HTTPS."],
      },
    ],
    steps: [
      "Souscrivez à Business (essai de 72 heures).",
      "Vérifiez la propriété de votre site.",
      "Configurez vos points de contrôle et votre scénario de parcours.",
      "Suivez la disponibilité et les incidents depuis le tableau de bord Business.",
    ],
    faqs: [
      {
        q: "Combien de points de contrôle sont inclus ?",
        a: "Trois points de contrôle (des adresses de votre site : accueil, page produit…) vérifiés chaque minute, et un scénario navigateur toutes les deux heures pour le site inclus dans la formule.",
      },
      {
        q: "Les contrôles sont-ils faits depuis plusieurs pays ?",
        a: "Non. Les contrôles sont effectués depuis les serveurs de Waverti, situés à un seul emplacement. Un « point de contrôle » est une adresse de votre site, pas un lieu géographique. Pour éviter les fausses alertes, chaque échec est revérifié avant l'ouverture d'un incident.",
      },
      {
        q: "Le certificat HTTPS est-il surveillé ?",
        a: "Oui, une fois par jour : Waverti vous prévient avant son expiration.",
      },
    ],
    cta: { label: "Découvrir Waverti Business", href: "/entreprises" },
  },
};
