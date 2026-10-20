// Réglages du blog. Les articles se trouvent dans blog/articles (un fichier .md
// par article) ; ce fichier ne change que si le site lui-même change.

export default {
  siteUrl: "https://www.lullin-web.com",
  siteName: "Lullin Web",
  language: "fr-FR",
  locale: "fr_FR",
  email: "contact@lullin-web.com",
  logo: { path: "/images/favicon-512.png", width: 512, height: 512 },
  defaultImage: {
    path: "/images/og-cover.jpg",
    width: 1200,
    height: 630,
    alt: "Lullin Web, création de sites internet sur mesure",
  },

  blog: {
    path: "/blog",
    title: "Blog : conseils pour créer votre site internet | Lullin Web",
    description:
      "Guides concrets pour artisans, commerçants, indépendants et TPE : prix d’un site internet, contenu, obligations légales et visibilité sur Google.",
    label: "Guides et conseils",
    heading: "Des conseils clairs pour *votre site internet.*",
    intro:
      "Prix, contenu, obligations, visibilité sur Google : des guides concrets et sourcés pour les artisans, commerçants, indépendants et petites entreprises qui veulent un site utile, sans jargon.",
  },

  // Mêmes liens que l'en-tête, le menu mobile et le pied de page du site React,
  // avec « Blog » en plus. À garder alignés avec src/App.tsx.
  navigation: [
    { label: "Expertises", href: "/services" },
    { label: "Réalisations", href: "/realisations" },
    { label: "L’agence", href: "/a-propos" },
    { label: "Offres", href: "/offres" },
    { label: "Blog", href: "/blog" },
  ],
  mobileNavigation: [
    { label: "Expertises", href: "/services" },
    { label: "Réalisations", href: "/realisations" },
    { label: "L’agence", href: "/a-propos" },
    { label: "Offres", href: "/offres" },
    { label: "Notre méthode", href: "/methode" },
    { label: "Questions fréquentes", href: "/faq" },
    { label: "Blog", href: "/blog" },
    { label: "Devenir partenaire", href: "/partenaires" },
    { label: "Parlons de votre projet", href: "/contact" },
  ],
  footerNavigation: [
    { label: "Expertises", href: "/services" },
    { label: "Réalisations", href: "/realisations" },
    { label: "L’agence", href: "/a-propos" },
    { label: "Offres", href: "/offres" },
    { label: "Méthode", href: "/methode" },
    { label: "FAQ", href: "/faq" },
    { label: "Blog", href: "/blog" },
    { label: "Partenaires", href: "/partenaires" },
    { label: "Contact", href: "/contact" },
  ],

  // Même mesure d'audience que src/consent.tsx : Google Analytics n'est chargé
  // qu'après « Accepter », et le choix est partagé avec le reste du site via la
  // même clé de stockage. Mettre gaMeasurementId à "" pour ne rien charger.
  analytics: {
    gaMeasurementId: "G-QLDMCG36NE",
    consentStorageKey: "lw-consent",
    acceptedValue: "accepte",
    refusedValue: "refuse",
  },

  // Bloc d'appel à l'action inséré à la place de <!-- cta --> dans un article,
  // si l'article ne définit pas ses propres textes (cta, ctaButton).
  cta: {
    text: "Vous voulez un site clair, rapide et à votre image, avec un prix connu avant de commencer ? Présentez-nous votre activité : la réponse est gratuite et sans engagement.",
    button: "Demander mon devis gratuit",
    href: "/contact",
  },
};
