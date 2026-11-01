/**
 * Réponses Brave SIMULÉES au format documenté de l'API (web.results[].title/url/description/page_age/meta_url).
 * Ce ne sont pas des enregistrements de vraies réponses : aucun appel Brave réel n'a été effectué pour les produire.
 * Les descriptions contiennent volontairement des prix : un extrait n'est jamais un prix vérifié.
 */
export interface FakeResult {
  title: string;
  url: string;
  description?: string;
  page_age?: string;
}

export function braveBody(results: FakeResult[]): string {
  return JSON.stringify({
    type: "search",
    query: { original: "x", show_strict_warning: false, is_navigational: false },
    web: {
      type: "search",
      results: results.map((r) => ({
        title: r.title,
        url: r.url,
        description: r.description ?? "",
        page_age: r.page_age,
        is_source_local: false,
        meta_url: { scheme: "https", netloc: new URL(r.url).host, hostname: new URL(r.url).hostname, path: new URL(r.url).pathname },
      })),
    },
  });
}

/** Résultats d'une recherche « NumWorks N0120 » : vendeurs, doublons, accessoire, ancien modèle, bruit. */
export function numworksResults(shopUrl: (host: string, path?: string) => string): FakeResult[] {
  return [
    { title: "Calculatrice NumWorks N0120 - neuf | Boutique A", url: shopUrl("boutique-a.test", "/produit"), description: "Calculatrice graphique NumWorks. Prix : 49,90 € livraison offerte. En stock." },
    // Doublon de A : paramètres de suivi.
    { title: "Calculatrice NumWorks N0120 - neuf | Boutique A", url: `${shopUrl("boutique-a.test", "/produit")}?utm_source=brave&gclid=zz`, description: "Même page." },
    { title: "NumWorks N0120 calculatrice", url: shopUrl("boutique-b.test", "/produit"), description: "À partir de 19,99 €." },
    { title: "Calculatrice NumWorks N0120 reconditionnée", url: shopUrl("boutique-c.test", "/produit"), description: "Reconditionné garanti 12 mois, 59 €." },
    { title: "Coque de protection pour calculatrice NumWorks N0120", url: shopUrl("boutique-g.test", "/produit"), description: "Coque silicone, 12 €." },
    { title: "NumWorks N0110 ancien modèle", url: shopUrl("boutique-h.test", "/produit"), description: "Ancienne version, 5 €." },
    { title: "NumWorks N0120 — test et avis", url: "https://blog-hightech.test/test/numworks-n0120", description: "Notre test complet." },
    { title: "NumWorks — Wikipédia", url: "https://fr.wikipedia.org/wiki/NumWorks", description: "NumWorks est une société." },
    { title: "Rechercher NumWorks N0120", url: "https://boutique-z.test/recherche?q=numworks+n0120", description: "Résultats de recherche." },
    { title: "NumWorks N0120 pas cher | Idealo", url: "https://www.idealo.fr/prix/123/numworks-n0120.html", description: "Comparez les prix." },
  ];
}
