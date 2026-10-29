export const siteConfig = {
  name: "Watchly",
  url: (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, ""),
  description:
    "Watchly surveille pour vous les prix, les stocks, les annonces, les nouveautés et vos sites internet, et vous prévient quand quelque chose d'important se produit.",
  publisher: "LULLIN WEB",
  publisherUrl: "https://www.lullin-web.com",
  locale: "fr_FR",
  /**
   * Statut de lancement affiché publiquement :
   *  - preview : site de démonstration, paiements en mode test uniquement ;
   *  - beta : accès anticipé ;
   *  - live : lancement commercial (uniquement après validation juridique et compte marchand).
   */
  launchStatus: (process.env.NEXT_PUBLIC_LAUNCH_STATUS ?? "preview") as "preview" | "beta" | "live",
};

export const mainNav = [
  { href: "/#fonctionnalites", label: "Fonctionnalités" },
  { href: "/#comment-ca-marche", label: "Comment ça marche" },
  { href: "/entreprises", label: "Entreprises" },
  { href: "/telecharger", label: "Télécharger" },
  { href: "/tarifs", label: "Tarifs" },
] as const;
