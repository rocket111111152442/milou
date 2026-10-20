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

  // Mêmes liens, dans le même ordre, que l'en-tête, le menu mobile et le pied
  // de page du site React (src/App.tsx, tableau navigation + liens ajoutés).
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
    { label: "Blog", href: "/blog" },
    { label: "Notre méthode", href: "/methode" },
    { label: "Questions fréquentes", href: "/faq" },
    { label: "Devenir partenaire", href: "/partenaires" },
    { label: "Parlons de votre projet", href: "/contact" },
  ],
  footerNavigation: [
    { label: "Expertises", href: "/services" },
    { label: "Réalisations", href: "/realisations" },
    { label: "L’agence", href: "/a-propos" },
    { label: "Offres", href: "/offres" },
    { label: "Blog", href: "/blog" },
    { label: "Méthode", href: "/methode" },
    { label: "FAQ", href: "/faq" },
    { label: "Partenaires", href: "/partenaires" },
    { label: "Contact", href: "/contact" },
  ],

  // Mesure d'audience Google Analytics, désactivée tant que le site lui-même
  // ne la charge pas (la page de confidentialité annonce « aucun cookie de
  // suivi »). Pour l'activer avec src/consent.tsx, mettre "G-QLDMCG36NE" :
  // le blog la chargera alors seulement après « Accepter », avec la même clé.
  analytics: {
    gaMeasurementId: "",
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
