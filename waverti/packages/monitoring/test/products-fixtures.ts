/** Fabrique de fiches produit HTML fictives (boutiques de test). Aucune donnée réelle, aucun site tiers. */

export const GTIN = "4006381333931";
export const GTIN_OTHER = "4006381333948";

export interface LdOffer {
  price?: string | number;
  priceCurrency?: string;
  availability?: string;
  itemCondition?: string;
  url?: string;
  sku?: string;
  seller?: string;
  shippingDetails?: unknown;
}

export const schema = (name: string) => `https://schema.org/${name}`;

export function ldProduct(p: { name?: string; brand?: string; mpn?: string; gtin13?: string; sku?: string; color?: string; size?: string; model?: string; url?: string; offers?: LdOffer | LdOffer[] | object; extra?: Record<string, unknown> }) {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    ...(p.name !== undefined ? { name: p.name } : {}),
    ...(p.brand ? { brand: { "@type": "Brand", name: p.brand } } : {}),
    ...(p.mpn ? { mpn: p.mpn } : {}),
    ...(p.gtin13 ? { gtin13: p.gtin13 } : {}),
    ...(p.sku ? { sku: p.sku } : {}),
    ...(p.color ? { color: p.color } : {}),
    ...(p.size ? { size: p.size } : {}),
    ...(p.model ? { model: p.model } : {}),
    ...(p.url ? { url: p.url } : {}),
    ...(p.offers ? { offers: p.offers } : {}),
    ...(p.extra ?? {}),
  };
}

export const offer = (o: LdOffer) => ({ "@type": "Offer", ...o });

export function html(opts: { title?: string; ld?: unknown[]; rawLd?: string[]; head?: string; body?: string } = {}): string {
  const blocks = [
    ...(opts.ld ?? []).map((x) => `<script type="application/ld+json">${JSON.stringify(x)}</script>`),
    ...(opts.rawLd ?? []).map((x) => `<script type="application/ld+json">${x}</script>`),
  ].join("\n");
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${opts.title ?? "Boutique"}</title>${opts.head ?? ""}${blocks}</head><body>${opts.body ?? "<h1>Boutique</h1>"}</body></html>`;
}

/** Fiche complète et bien renseignée. */
export function goodPage(over: { name?: string; price?: string | number; currency?: string; availability?: string; condition?: string; gtin?: string; mpn?: string; brand?: string; shipping?: unknown } = {}) {
  return html({
    ld: [
      ldProduct({
        name: over.name ?? "Calculatrice graphique NumWorks N0120 noire",
        brand: over.brand ?? "NumWorks",
        mpn: over.mpn ?? "N0120",
        gtin13: over.gtin ?? GTIN,
        offers: offer({
          price: over.price ?? "99.00",
          priceCurrency: over.currency ?? "EUR",
          availability: schema(over.availability ?? "InStock"),
          itemCondition: schema(over.condition ?? "NewCondition"),
          ...(over.shipping ? { shippingDetails: over.shipping } : {}),
        }),
      }),
    ],
  });
}

export const shippingFR = (value: number | string, currency = "EUR") => ({
  "@type": "OfferShippingDetails",
  shippingRate: { "@type": "MonetaryAmount", value, currency },
  shippingDestination: { "@type": "DefinedRegion", addressCountry: "FR" },
});
