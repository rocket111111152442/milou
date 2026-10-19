// Informations de l'agence : c'est LE fichier à adapter pour réutiliser la solution avec une autre agence
// (avec les textes de public/index.html, les couleurs de public/styles.css et les images).
// Après toute modification : node scripts/build-pages.mjs
//
// Les informations légales ci-dessous ont été relevées sur le site actuel de l'agence (aei-var.com, mentions
// légales et honoraires) le 19/10/2026. Elles doivent être CONFIRMÉES par l'agence avant la mise en ligne.
// Les valeurs « À compléter » sont affichées telles quelles dans les mentions légales pour ne rien inventer.
export default {
  nom: 'Agence Européenne Immobilière – Côté Mer',
  nomCourt: 'AEI Côté Mer',
  siteUrl: process.env.SITE_URL || 'https://aei-cote-mer.vercel.app',
  adresse: '175 avenue Joseph Raynaud',
  codePostal: '83140',
  ville: 'Six-Fours-les-Plages',
  telephone: '04 94 07 26 35',
  email: 'aei.cotemer@gmail.com',
  horaires: 'Du lundi au vendredi, 9h – 12h et 14h – 18h30',

  // Mettre à true UNIQUEMENT à la mise en production : autorise Google à indexer le site (puis relancer build-pages).
  indexable: false,

  // Langues proposées (le français est la langue d'origine ; les traductions sont dans public/i18n-dict.js)
  langues: ['fr', 'en', 'de'],

  legal: {
    raisonSociale: 'AGENCE EUROPEENNE IMMOBILIERE COTE MER (AEI COTE MER)',
    formeJuridique: 'SARL',
    siren: '828 494 674',
    siret: '828 494 674 00025',
    rcs: 'RCS Toulon',
    capital: '5 000 €',
    tva: 'FR72 828494674',
    directeurPublication: 'Jocelyn Gambier, directeur gérant',
    carteProfessionnelle: 'Carte « Transactions sur immeubles et fonds de commerce » TG n° CPI 8305 2017 000 019 695, délivrée par la CCI du Var',
    garantieFinanciere: 'Galian (SMABTP) – 120 000 €',
    assuranceRcp: 'À compléter (assureur et n° de contrat de la responsabilité civile professionnelle)',
    mediateur: 'ANM CONSO – 2 rue Colmar, 94300 Vincennes – www.anm-conso.com',
    nonDetentionFonds: 'À compléter (préciser si l’agence détient ou non des fonds pour le compte de tiers)',
  },

  hebergeur: {
    nom: 'Vercel Inc.',
    adresse: '440 N Barranca Ave #4133, Covina, CA 91723, États-Unis',
    site: 'https://vercel.com',
  },

  // Réseau d'agences (relevé sur le site actuel). Les champs null ne sont pas affichés.
  agences: [
    {
      id: 'six-fours', nom: 'Six-Fours-les-Plages', siege: true,
      adresse: '175 avenue Joseph Raynaud', codePostal: '83140', ville: 'Six-Fours-les-Plages',
      telephone: '04 94 07 26 35', email: 'aei.cotemer@gmail.com', site: null, responsable: 'Jocelyn Gambier',
      description: 'Transaction, estimation, location et gestion locative sur le littoral ouest varois.',
    },
    {
      id: 'saint-maximin', nom: 'Saint-Maximin (centre Var)', siege: false,
      adresse: '217 avenue Maréchal Foch', codePostal: '83470', ville: 'Saint-Maximin-la-Sainte-Baume',
      telephone: '04 94 72 30 69', email: 'aei.stmaximin@gmail.com', site: 'https://www.aei-centrevar.com', responsable: null,
      description: 'L’agence du centre Var dispose de son propre site.',
    },
    {
      id: 'loiret', nom: 'Loiret (Gien, Nevoy)', siege: false,
      adresse: null, codePostal: '45500', ville: 'Gien',
      telephone: '06 50 50 07 86', email: 'paul.khayat.aei@gmail.com', site: null, responsable: 'Paul Khayat',
      description: 'Agence créée par le négociateur Paul Khayat, installé à Gien depuis plus de dix ans : ventes, acquisitions et avis de valeur dans le Loiret.',
    },
  ],

  // Barèmes d'honoraires TTC relevés sur le site actuel (page « Honoraires »). Obligatoire dans une agence.
  honoraires: {
    releveLe: '19/10/2026',
    baremes: [
      {
        agence: 'Agence de Six-Fours-les-Plages',
        vente: {
          tranches: [
            ['Jusqu’à 50 000 €', '6 000 €'], ['50 001 € – 100 000 €', '8 000 €'], ['100 001 € – 150 000 €', '10 000 €'],
            ['150 001 € – 200 000 €', '12 000 €'], ['200 001 € – 250 000 €', '14 000 €'], ['250 001 € – 300 000 €', '16 000 €'],
            ['300 001 € – 350 000 €', '18 000 €'], ['350 001 € – 400 000 €', '20 000 €'], ['400 001 € – 450 000 €', '22 000 €'],
            ['450 001 € – 500 000 €', '24 000 €'], ['500 001 € – 550 000 €', '26 000 €'], ['550 001 € – 600 000 €', '28 000 €'],
            ['600 001 € – 700 000 €', '30 000 €'], ['700 001 € – 800 000 €', '35 000 €'], ['800 001 € – 900 000 €', '40 000 €'],
            ['900 001 € – 1 000 000 €', '45 000 €'], ['Au-delà de 1 000 000 €', '5 %'],
          ],
          note: 'Tous types de mandat. En cas d’inter-cabinet, les honoraires ne dépasseront pas les valeurs du présent barème ni celle indiquée sur le mandat de vente et/ou de recherche consenti par le mandant.',
        },
        location: [
          'Honoraires à la charge du locataire et du propriétaire.',
          'Visite du preneur, constitution de son dossier et rédaction du bail : 10 € TTC du m².',
          'Réalisation de l’état des lieux : 3 € TTC du m².',
        ],
        gestion: [
          'Gestion locative : 7 % TTC du montant du loyer encaissé, charges comprises.',
          'Garantie de loyers impayés (sans plafond d’indemnisation, sans carence, frais juridiques et de dégradation immobilière inclus) : 2,7 % TTC du montant du loyer encaissé, charges comprises.',
        ],
      },
      {
        agence: 'Agence de Nevoy (Loiret)',
        vente: {
          tranches: [
            ['Jusqu’à 80 000 €', '6 000 €'], ['80 001 € – 130 000 €', '8 000 €'], ['130 001 € – 220 000 €', '10 000 €'],
            ['220 001 € – 250 000 €', '11 000 €'], ['250 001 € – 290 000 €', '12 000 €'], ['Au-delà de 290 001 €', '4 %'],
          ],
          note: 'Tous types de mandat. En cas d’inter-cabinet, les honoraires ne dépasseront pas les valeurs du présent barème ni celle indiquée sur le mandat.',
        },
        location: ['L’agence de Nevoy ne propose pas de service de location ni de gestion locative.'],
        gestion: [],
      },
      {
        agence: 'Agence du Loiret (Paul Khayat)',
        vente: {
          tranches: [
            ['Jusqu’à 80 000 €', '6 000 €'], ['80 001 € – 130 000 €', '8 000 €'], ['130 001 € – 220 000 €', '10 000 €'],
            ['220 001 € – 250 000 €', '11 000 €'], ['250 001 € – 290 000 €', '12 000 €'], ['Au-delà de 290 001 €', '4 %'],
          ],
          note: 'Tous types de mandat. En cas d’inter-cabinet, les honoraires ne dépasseront pas les valeurs du présent barème ni celle indiquée sur le mandat.',
        },
        location: [
          'Honoraires à la charge du locataire.',
          'Visite du preneur, constitution de son dossier et rédaction du bail : 8 € TTC du m².',
          'Réalisation de l’état des lieux : 3 € TTC du m².',
        ],
        gestion: [],
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
