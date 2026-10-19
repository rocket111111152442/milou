// Informations de l'agence : c'est LE fichier à adapter pour réutiliser la solution avec une autre agence
// (avec les textes de public/index.html, les couleurs de public/styles.css et les images).
// Après toute modification : node scripts/build-pages.mjs
//
// Relevés du 19/10/2026 :
// - site actuel de l'agence (acorimmo.fr : contact, histoire, équipe, honoraires, gestion locative, mentions légales) ;
// - annuaire officiel des entreprises (recherche-entreprises.api.gouv.fr) pour le SIREN, la forme juridique et la gérance ;
// - fiches Google Maps des quatre agences pour les notes.
// Tout doit être CONFIRMÉ par l'agence avant la mise en ligne. Les valeurs « À compléter » sont affichées telles quelles
// dans les mentions légales pour ne rien inventer.
export default {
  nom: 'Acor’Immo',
  nomCourt: 'Acor’Immo',
  siteUrl: process.env.SITE_URL || 'https://acorimmo.vercel.app',
  // Siège social (mentions légales du site actuel et annuaire des entreprises)
  adresse: '9 bis, rue Amable Lagane',
  codePostal: '83500',
  ville: 'La Seyne-sur-Mer',
  telephone: '04 94 30 00 16',
  telephoneLien: '+33494300016', // format international, pour les liens « tel: »
  email: 'acorimmo@orange.fr',
  // Google Maps (affichage limité, sans compte) ne montre que le jour en cours ; le site actuel n'indique pas d'horaires.
  horaires: 'À compléter (Google Maps indique le lundi 9h – 12h et 14h – 18h pour les quatre agences, relevé du 19/10/2026)',

  // Mettre à true UNIQUEMENT à la mise en production : autorise Google à indexer le site (puis relancer build-pages).
  indexable: false,

  // Langues proposées (le français est la langue d'origine ; les traductions sont dans public/i18n-dict.js)
  langues: ['fr', 'en', 'de'],

  legal: {
    raisonSociale: 'ACOR’IMMO',
    formeJuridique: 'SARL (société à responsabilité limitée)',
    siren: '448 929 091',
    siret: '448 929 091 00032 (siège)',
    rcs: 'À compléter (greffe d’immatriculation, à lire sur l’extrait Kbis)',
    capital: 'À compléter',
    tva: 'À compléter',
    directeurPublication: 'Adeline Boz, gérante',
    carteProfessionnelle: 'À compléter (n° de carte « Transactions » / « Gestion » et CCI de délivrance : non publiés sur le site actuel)',
    garantieFinanciere: 'À compléter (organisme garant et montant, transaction et gestion)',
    assuranceRcp: 'À compléter (assureur et n° de contrat de la responsabilité civile professionnelle)',
    mediateur: 'ANM Conso – 62 rue Tiquetonne, 75002 Paris – www.anm-conso.com',
    nonDetentionFonds: 'À compléter (l’agence pratique la gestion locative : préciser les fonds détenus pour le compte de tiers et la garantie correspondante)',
  },

  hebergeur: {
    nom: 'Vercel Inc.',
    adresse: '440 N Barranca Ave #4133, Covina, CA 91723, États-Unis',
    site: 'https://vercel.com',
  },

  // Agences (page Contact et page Histoire du site actuel). Les champs null ne sont pas affichés.
  // avisGoogle : note relevée sur la fiche Google Maps de chaque agence.
  agences: [
    {
      id: 'la-seyne', nom: 'La Seyne-sur-Mer', siege: true,
      adresse: '9 bis, rue Amable Lagane', codePostal: '83500', ville: 'La Seyne-sur-Mer',
      telephone: '04 94 30 00 16', email: 'acorimmo@orange.fr', site: null, responsable: null,
      description: 'L’agence historique : ouverte en 2002 entre l’église et le port, installée depuis 2011 dans les locaux de « La Maison Bleue », rue Lagane.',
      avisGoogle: { note: 4.9, nombre: 186, releveLe: '19/10/2026' },
    },
    {
      id: 'six-fours', nom: 'Six-Fours-les-Plages', siege: false,
      adresse: '39, rue de la République', codePostal: '83140', ville: 'Six-Fours-les-Plages',
      telephone: '04 94 74 65 69', email: 'acorimmo@orange.fr', site: null, responsable: null,
      description: 'Ouverte en 2015 dans une maison de village provençale, face au cinéma et à proximité des écoles.',
      avisGoogle: { note: 4.9, nombre: 153, releveLe: '19/10/2026' },
    },
    {
      id: 'sanary', nom: 'Sanary-sur-Mer', siege: false,
      adresse: '41, rue Jean Jaurès', codePostal: '83110', ville: 'Sanary-sur-Mer',
      telephone: '04 94 07 49 20', email: 'acorimmo@orange.fr', site: null, responsable: null,
      description: 'Ouverte en 2020 entre le port et le marché, dans les murs d’une agence immobilière présente depuis les années 1930.',
      avisGoogle: { note: 5.0, nombre: 92, releveLe: '19/10/2026' },
    },
    {
      id: 'toulon', nom: 'Toulon', siege: false,
      adresse: '15, avenue Colbert', codePostal: '83000', ville: 'Toulon',
      telephone: '04 94 01 26 27', email: 'acorimmo@orange.fr', site: null, responsable: null,
      description: 'Ouverte en janvier 2025 dans un bâtiment haussmannien, à deux pas de l’Opéra et de la place de la Liberté.',
      avisGoogle: { note: 5.0, nombre: 73, releveLe: '19/10/2026' },
    },
  ],

  // Barème TTC relevé tel quel sur le site actuel (page « Honoraires », « barème en vigueur au 10 avril 2024 »,
  // complété par la page « Gestion locative »). Obligatoire dans une agence.
  honoraires: {
    releveLe: '19/10/2026',
    baremes: [
      {
        agence: 'Toutes nos agences (barème en vigueur au 10 avril 2024)',
        vente: {
          tranches: [
            ['Jusqu’à 99 999 €', '7 000 €'],
            ['De 100 000 € à 299 999 €', '7 %'],
            ['De 300 000 € à 499 999 €', '6 %'],
            ['De 500 000 € à 999 999 €', '5 %'],
            ['1 000 000 € et plus', '4 %'],
          ],
          note: 'Tranches exprimées en prix net vendeur. Tous les honoraires sont à la charge du vendeur sauf exceptions (successions, mandat de recherche, etc.). Forfait vente d’annexes (garage, box, cave, etc.) : 3 500 € TTC. Estimation : 150 € (offerte pour la signature d’un mandat de vente).',
        },
        location: [
          'Visites, constitution du dossier et rédaction des actes : 10 € TTC du m².',
          'État des lieux : 3 € TTC du m².',
          'Page « Gestion locative » du site actuel : honoraires de location à la charge du bailleur ; cas particulier du centre-ville de La Seyne : 1/2 mois de loyer charges comprises.',
        ],
        gestion: [
          'Honoraires de gestion (sur tout encaissement), compte rendu trimestriel : 7 % TTC.',
          'Frais administratifs fixes annuels : 20 € TTC.',
          'Garantie loyers impayés et détériorations immobilières : 2 % TTC selon la page « Honoraires », 2,1 % TTC selon la page « Gestion locative » (taux à confirmer).',
        ],
      },
    ],
  },

  // Durées de conservation annoncées dans la politique de confidentialité
  conservation: {
    demandesMois: 36, // 3 ans après le dernier contact (recommandation CNIL pour la prospection)
    sauvegardesJours: 30,
    audienceMois: 13, // mesure d'audience sans cookie : compteurs agrégés, sans donnée personnelle
  },
};
