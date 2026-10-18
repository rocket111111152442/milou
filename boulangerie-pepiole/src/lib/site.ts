// Informations générales de la maison. Les infos propres à chaque boutique
// (adresse, horaires, téléphone, société) sont dans shops.ts.

export const SITE = {
  name: "Le Pétrin de Pépiole",
  shortName: "Pétrin de Pépiole",
  tagline: "Artisan Boulanger",
  description:
    "Boulangerie artisanale à Sanary-sur-Mer (Le Pétrin de Pépiole) et à Six-Fours-les-Plages (Maison Sernesi) : pains de tradition, levain, viennoiseries, pâtisseries, snacking et pause café. Ouvert 7 jours sur 7. Commande en ligne et retrait en boutique.",
  url: process.env.NEXT_PUBLIC_SITE_URL || "https://petrin-de-pepiole.vercel.app",

  instagram: {
    handle: "@lepetrindepepiole",
    url: "https://www.instagram.com/lepetrindepepiole/",
  },
  priceRange: "1–10 €",

  legal: {
    publicationDirector: "Myriam Glomaud, présidente d'AS BOULANGERIE et de MCS BOULANGERIE",
    host: {
      name: "Vercel Inc.",
      address: "440 N Barranca Ave #4133, Covina, CA 91723, États-Unis",
      url: "https://vercel.com",
    },
  },
} as const;

export const NAV = [
  { href: "/#maison", label: "La maison" },
  { href: "/#savoir-faire", label: "Savoir-faire" },
  { href: "/carte", label: "La carte" },
  { href: "/#boutiques", label: "Nos boutiques" },
] as const;
