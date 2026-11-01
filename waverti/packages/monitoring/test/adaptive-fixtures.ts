import type { SafeFetchResult } from "../src/net/safe-fetch";

export const target = { url: "https://example.org/page", cssSelector: null };
export function response(body: string, contentType = "text/html", status = 200): SafeFetchResult {
  return { url: target.url, finalUrl: target.url, status, headers: { "content-type": contentType }, contentType, body: Buffer.from(body), truncated: false, redirects: 0, durationMs: 1, remoteAddress: null };
}
const html = (title: string, body: string) => `<html><head><title>${title}</title></head><body>${body}</body></html>`;
export const fixtures = [
  ...["boutique", "vitrine", "blog", "média", "annonce", "immobilier", "réservation", "documentation"].map((family) => ({
    name: family, res: response(html(family, `<main><h1>${family}</h1><p>Informations publiques sur ${family}, mises à jour chaque semaine pour tous les visiteurs.</p></main>`)), title: family, format: "html", needsBrowser: false,
  })),
  ...["root", "__next", "app", "__nuxt"].flatMap((id) => [
    { name: `${id}-empty`, res: response(html("Application", `<div id="${id}"></div><script src="/app.js"></script>`)), title: "Application", format: "html", needsBrowser: true },
    { name: `${id}-SSR`, res: response(html("Produit", `<div id="${id}">Produit<script type="application/ld+json">{"@type":"Offer","price":25,"priceCurrency":"EUR"}</script></div>`)), title: "Produit", format: "html", needsBrowser: false },
  ]),
  ...["EUR", "USD", "GBP", "CHF"].map((currency) => ({ name: `jsonld-${currency}`, res: response(html("Produit", `<script type="application/ld+json">{"@type":"Product","name":"Produit","offers":{"@type":"Offer","price":25,"priceCurrency":"${currency}","availability":"https://schema.org/InStock"}}</script>`)), title: "Produit", price: 25, format: "html", needsBrowser: false })),
  ...["application/json", "application/ld+json"].map((mime) => ({ name: mime, res: response('{"@type":"Product","name":"Produit API","offers":{"@type":"Offer","price":25,"priceCurrency":"EUR"}}', mime), title: "Produit API", price: 25, format: "json", needsBrowser: false })),
  ...["application/rss+xml", "application/xml", "text/xml"].map((mime) => ({ name: `rss-${mime}`, res: response('<rss><channel><title>Actualités</title><item><title>Ouverture</title><link>https://example.org/event</link><description>Le musée ouvre le 2026-11-02.</description></item></channel></rss>', mime), title: "Actualités", format: "feed", needsBrowser: false })),
  { name: "atom", res: response('<feed xmlns="http://www.w3.org/2005/Atom"><title>Documentation</title><entry><title>Version 2</title><link href="/v2"/><summary>Nouvelle version publique.</summary></entry></feed>', "application/atom+xml"), title: "Documentation", format: "feed", needsBrowser: false },
  { name: "angular", res: response(html("Angular", '<app-root ng-version="20"></app-root>')), title: "Angular", format: "html", needsBrowser: true },
  { name: "vue", res: response(html("Vue", '<section data-v-app></section>')), title: "Vue", format: "html", needsBrowser: true },
  { name: "plain-text", res: response("Documentation publique <tag> qui reste du texte.", "text/plain"), title: null, format: "text", needsBrowser: false },
  { name: "json-data", res: response('{"message":"in stock 25 EUR","count":25}', "application/json"), title: null, price: null, format: "json", needsBrowser: false },
  ...[404, 500, 503].map((status) => ({ name: `http-${status}`, res: response(html("Erreur", "Service indisponible"), "text/html", status), title: "Erreur", format: "html", needsBrowser: false })),
  ...[401, 403, 429, 451].map((status) => ({ name: `restriction-${status}`, res: response(html("Accès limité", "Veuillez vous connecter"), "text/html", status), title: "Accès limité", format: "html", needsBrowser: false, blocked: true })),
  { name: "challenge-200", res: response(html("Just a moment", '<div id="root">Verify you are human</div>')), title: "Just a moment", format: "html", needsBrowser: false, blocked: true },
  { name: "pdf-text", res: response('%PDF-1.4\n<< /Length 80 >>\nstream\nBT (Documentation publique de plus de vingt caracteres.) Tj ET\nendstream\n%%EOF', "application/pdf"), title: "page", format: "pdf", needsBrowser: false },
  { name: "pdf-encrypted", res: response('%PDF-1.4 /Encrypt 1 0 R', "application/pdf"), title: "page", format: "pdf", needsBrowser: false },
];
