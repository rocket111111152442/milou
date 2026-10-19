// Contenu de départ des pages communes et des avis (textes publiés par l'agence sur son site actuel, relevés le 19/10/2026).
// Utilisé tant que l'agence n'a rien enregistré dans l'admin (Communes & avis). Aucun prix au m² : l'estimation indicative
// reste désactivée tant que l'agence n'en a pas saisi. Pour une autre agence : vider ces deux listes.
const slug = (s) => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const C = [
  ['Six-Fours-les-Plages', '83140', 'Le Brusc, Les Lônes, la Coudoulière',
    'Vous êtes propriétaire à Six-Fours-les-Plages et souhaitez connaître la valeur réelle de votre bien immobilier ? Notre agence vous propose une estimation immobilière précise et personnalisée, tenant compte des spécificités du marché local.\n\nQue vous envisagiez de vendre un appartement avec vue mer, une maison provençale ou un terrain constructible, notre équipe vous accompagne avec rigueur. À Six-Fours-les-Plages, les prix au m² peuvent varier selon les quartiers : Le Brusc, Les Lônes, la Coudoulière… C’est pourquoi nous réalisons une analyse détaillée, basée sur les biens comparables récemment vendus, les tendances actuelles et les atouts de votre bien.\n\nNotre objectif est de vous fournir un avis de valeur fiable, pour vendre rapidement et au bon prix.'],
  ['Sanary-sur-Mer', '83110', '',
    'Vous êtes propriétaire à Sanary-sur-Mer et vous vous interrogez sur la valeur actuelle de votre bien ? Que vous envisagiez de vendre, de transmettre ou simplement de suivre l’évolution de votre patrimoine, l’Agence Européenne Immobilière vous propose une estimation immobilière précise et personnalisée.\n\nNotre équipe s’appuie sur une connaissance fine du secteur, les prix au m² pratiqués localement, les ventes récentes, et bien sûr, les caractéristiques propres à votre bien. Maison avec vue mer, appartement en centre-ville ou villa dans un quartier résidentiel : chaque estimation reflète la réalité du marché.'],
  ['Ollioules', '83190', 'Centre historique, campagne environnante, quartiers résidentiels',
    'Vous envisagez de vendre votre bien situé à Ollioules ? Avant toute démarche, il est essentiel de connaître sa valeur réelle sur le marché actuel. L’Agence Européenne Immobilière vous propose une estimation immobilière précise, gratuite et sans engagement.\n\nNous prenons en compte les caractéristiques de votre bien (surface, état, emplacement), les spécificités du secteur (centre historique, campagne environnante, quartiers résidentiels), ainsi que les prix au m² observés localement. Que vous soyez propriétaire d’une maison de village, d’un appartement ou d’un terrain, nous vous offrons un accompagnement sur mesure.'],
  ['La Seyne-sur-Mer', '83500', 'Centre-ville, Mar Vivo, Balaguier',
    'Vous possédez un bien à La Seyne-sur-Mer et souhaitez en connaître la valeur réelle ? Que ce soit dans le cadre d’un projet de vente, de succession ou simplement pour faire le point sur votre patrimoine, l’Agence Européenne Immobilière vous propose une estimation immobilière fiable et sans engagement.\n\nGrâce à notre expertise terrain, nous analysons les spécificités de votre bien (localisation, état, prestations) tout en tenant compte du prix moyen au m² dans votre quartier, des transactions récentes et des tendances du marché local. Du centre-ville aux quartiers résidentiels comme Mar Vivo ou Balaguier, chaque secteur a ses particularités.'],
];

export const communes = { marge: 10, communes: C.map(([nom, cp, quartiers, intro]) => ({ slug: slug(nom), nom, cp, quartiers, intro, prixM2Maison: '', prixM2Appartement: '', source: '', date: '' })) };

export const avis = {
  agregat: { note: 4.7, nombre: 73, source: 'PagesJaunes', url: '', releveLe: '2026-10-17' },
  avis: [{ id: 'a-site-actuel', auteur: 'Client', note: 5, texte: 'Très bonne agence. Très professionnelle.', date: '', source: 'Site actuel de l’agence', url: '', publie: true }],
};
