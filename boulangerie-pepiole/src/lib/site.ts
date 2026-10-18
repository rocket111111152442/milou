// Informations de la boutique.
// Sources : fiche Google Maps, registre SIRENE (INSEE / annuaire-entreprises.data.gouv.fr),
// Office de tourisme de Sanary-sur-Mer, MyBoulange.

export const SITE = {
  name: "Le Pétrin de Pépiole",
  shortName: "Pétrin de Pépiole",
  tagline: "Artisan Boulanger",
  city: "Sanary-sur-Mer",
  description:
    "Boulangerie artisanale près de la gare d'Ollioules–Sanary : pains de tradition, levain, viennoiseries, pâtisseries, snacking et pause café. Ouvert 7 jours sur 7. Commande en ligne et retrait en boutique.",
  url: process.env.NEXT_PUBLIC_SITE_URL || "https://petrin-de-pepiole.vercel.app",

  address: {
    street: "1191 Route de la Gare",
    postalCode: "83110",
    city: "Sanary-sur-Mer",
    region: "Var",
    country: "FR",
    landmark: "À deux pas de la gare d'Ollioules – Sanary",
    plusCode: "4RFF+F2 Sanary-sur-Mer",
  },
  geo: { lat: 43.123302705, lng: 5.8225049686 },

  phone: { display: "04 94 32 57 47", href: "tel:+33494325747" },
  instagram: {
    handle: "@lepetrindepepiole",
    url: "https://www.instagram.com/lepetrindepepiole/",
  },
  mapsUrl:
    "https://www.google.com/maps/search/?api=1&query=Le+P%C3%A9trin+de+P%C3%A9piole+1191+Route+de+la+Gare+83110+Sanary-sur-Mer",
  directionsUrl:
    "https://www.google.com/maps/dir/?api=1&destination=Le+P%C3%A9trin+de+P%C3%A9piole+1191+Route+de+la+Gare+83110+Sanary-sur-Mer",
  mapEmbedUrl:
    "https://www.google.com/maps?q=Le+P%C3%A9trin+de+P%C3%A9piole,+1191+Route+de+la+Gare,+83110+Sanary-sur-Mer&z=16&output=embed",

  services: {
    takeaway: true,
    delivery: false,
    parking: true,
    accessible: true,
    pauseCafe: true,
  },
  priceRange: "1–10 €",
  since: 2014,

  legal: {
    company: "AS BOULANGERIE",
    tradeName: "Le Pétrin de Pépiole",
    form: "SAS (société par actions simplifiée)",
    siren: "802 932 665",
    siret: "802 932 665 00010",
    vat: "FR14802932665",
    naf: "10.71C – Boulangerie et boulangerie-pâtisserie",
    rcs: "RCS Toulon 802 932 665",
    headOffice: "1191 Route de la Gare, 83110 Sanary-sur-Mer",
    created: "17 juin 2014",
    publicationDirector: "Myriam Glomaud, Présidente",
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
  { href: "/#infos", label: "Infos pratiques" },
] as const;
