// Les boutiques de la maison.
// Sources : fiches Google Maps, registre SIRENE (annuaire-entreprises.data.gouv.fr),
// Office de tourisme de Sanary-sur-Mer, MyBoulange.
import type { Range } from "./hours";

export type ShopId = "sanary" | "six-fours";

export type Shop = {
  id: ShopId;
  /** Enseigne de la boutique */
  name: string;
  city: string;
  /** Libellé court, ex. dans les onglets */
  short: string;
  tagline: string;
  address: { street: string; postalCode: string; city: string; plusCode: string };
  landmark: string;
  geo: { lat: number; lng: number };
  phone: { display: string; href: string };
  /** 0 = dimanche … 6 = samedi */
  hours: Record<number, readonly Range[]>;
  /** Jours de fermeture exceptionnelle (AAAA-MM-JJ) */
  closedDates: readonly string[];
  image: string;
  imageAlt: string;
  services: string[];
  legal: {
    company: string;
    form: string;
    siren: string;
    siret: string;
    vat: string;
    rcs: string;
    created: string;
  };
};

function mapsQuery(q: string) {
  const e = encodeURIComponent(q);
  return {
    mapsUrl: `https://www.google.com/maps/search/?api=1&query=${e}`,
    directionsUrl: `https://www.google.com/maps/dir/?api=1&destination=${e}`,
    mapEmbedUrl: `https://www.google.com/maps?q=${e}&z=16&output=embed`,
  };
}

const SANARY: Shop = {
  id: "sanary",
  name: "Le Pétrin de Pépiole",
  city: "Sanary-sur-Mer",
  short: "Sanary",
  tagline: "Près de la gare d'Ollioules – Sanary",
  address: { street: "1191 Route de la Gare", postalCode: "83110", city: "Sanary-sur-Mer", plusCode: "4RFF+F2 Sanary-sur-Mer" },
  landmark: "À deux pas de la gare d'Ollioules – Sanary, avec parking",
  geo: { lat: 43.123302705, lng: 5.8225049686 },
  phone: { display: "04 94 32 57 47", href: "tel:+33494325747" },
  hours: {
    0: [["07:00", "13:15"]],
    1: [["06:30", "19:30"]],
    2: [["06:30", "19:30"]],
    3: [["06:30", "19:30"]],
    4: [["06:30", "19:30"]],
    5: [["06:30", "19:30"]],
    6: [["06:30", "19:30"]],
  },
  closedDates: [],
  image: "/images/facade.jpg",
  imageAlt: "Façade de la boutique Le Pétrin de Pépiole à Sanary, enseigne Artisan Boulanger",
  services: ["Vente à emporter", "Parking", "Accès fauteuil roulant", "Pause café", "Ouvert le dimanche"],
  legal: {
    company: "AS BOULANGERIE",
    form: "SAS (société par actions simplifiée)",
    siren: "802 932 665",
    siret: "802 932 665 00010",
    vat: "FR14802932665",
    rcs: "RCS Toulon 802 932 665",
    created: "2014",
  },
};

const SIX_FOURS: Shop = {
  id: "six-fours",
  name: "Maison Sernesi",
  city: "Six-Fours-les-Plages",
  short: "Six-Fours",
  tagline: "Boulangerie · Pâtisserie · Snacking",
  address: { street: "230 Route des Sablettes", postalCode: "83140", city: "Six-Fours-les-Plages", plusCode: "3VQ2+HJ Six-Fours-les-Plages" },
  landmark: "Route des Sablettes, chemin Guérin",
  geo: { lat: 43.0889375, lng: 5.8515625 },
  phone: { display: "04 94 74 74 38", href: "tel:+33494747438" },
  hours: {
    0: [["06:30", "20:00"]],
    1: [["06:30", "20:00"]],
    2: [["06:30", "20:00"]],
    3: [["06:30", "20:00"]],
    4: [["06:30", "20:00"]],
    5: [["06:30", "20:00"]],
    6: [["06:30", "20:00"]],
  },
  closedDates: [],
  image: "/images/facade-six-fours.jpg",
  imageAlt: "Façade de Maison Sernesi à Six-Fours : boulangerie, pâtisserie, snacking",
  services: ["Vente à emporter", "Accès fauteuil roulant", "Snacking"],
  legal: {
    company: "MCS BOULANGERIE",
    form: "SAS (société par actions simplifiée)",
    siren: "878 642 776",
    siret: "878 642 776 00016",
    vat: "FR94878642776",
    rcs: "RCS Toulon 878 642 776",
    created: "2019",
  },
};

export const SHOPS: readonly Shop[] = [SANARY, SIX_FOURS];
export const SHOP_IDS = SHOPS.map((s) => s.id) as [ShopId, ...ShopId[]];
export const DEFAULT_SHOP: ShopId = "sanary";

export function getShop(id: string | null | undefined): Shop {
  return SHOPS.find((s) => s.id === id) ?? SANARY;
}

export function shopLinks(shop: Shop) {
  return mapsQuery(`${shop.name}, ${shop.address.street}, ${shop.address.postalCode} ${shop.address.city}`);
}
