// Une boutique d'un site généré : adresse, horaires, contact, mentions légales.
import type { Range } from "./hours";

export type ShopId = string;

export type Shop = {
  id: ShopId;
  /** Enseigne de la boutique */
  name: string;
  city: string;
  /** Libellé court, ex. dans les onglets */
  short: string;
  tagline: string;
  address: { street: string; postalCode: string; city: string };
  landmark: string;
  phone: { display: string; href: string };
  /** 0 = dimanche … 6 = samedi */
  hours: Record<number, readonly Range[]>;
  /** Jours de fermeture exceptionnelle (AAAA-MM-JJ) */
  closedDates: readonly string[];
  image: string;
  imageAlt: string;
  services: string[];
  /** Adresse(s) qui reçoivent les commandes de cette boutique (sinon celle du site) */
  orderEmail?: string;
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

export function getShop(shops: readonly Shop[], id: string | null | undefined): Shop {
  return shops.find((s) => s.id === id) ?? shops[0];
}

export function shopLinks(shop: Shop) {
  return mapsQuery(`${shop.name}, ${shop.address.street}, ${shop.address.postalCode} ${shop.address.city}`);
}

export function phoneHref(display: string) {
  const digits = display.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return `tel:${digits}`;
  if (digits.startsWith("0")) return `tel:+33${digits.slice(1)}`;
  return `tel:${digits}`;
}
