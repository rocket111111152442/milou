// Informations de l'agence : c'est le fichier à adapter pour réutiliser la solution
// avec une autre agence (avec les textes des pages HTML, les couleurs dans styles.css et les images).
// Les valeurs "À compléter" doivent être fournies par l'agence avant la mise en ligne :
// elles sont affichées telles quelles dans les mentions légales pour ne rien inventer.
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

  // Informations légales (sources publiques : annuaire-entreprises.data.gouv.fr)
  legal: {
    raisonSociale: 'AGENCE EUROPEENNE IMMOBILIERE COTE MER (AEI COTE MER)',
    formeJuridique: 'SARL',
    siren: '828 494 674',
    rcs: 'RCS Toulon',
    capital: 'À compléter',
    tva: 'À compléter',
    directeurPublication: 'À compléter (gérant de la société)',
    carteProfessionnelle: 'À compléter (carte T n° CPI …, délivrée par la CCI …)',
    garantieFinanciere: 'À compléter (organisme garant, adresse, montant)',
    assuranceRcp: 'À compléter (assureur responsabilité civile professionnelle)',
    mediateur: 'À compléter (médiateur de la consommation, coordonnées et site)',
    nonDetentionFonds: 'À compléter (préciser si l’agence détient ou non des fonds pour le compte de tiers)',
  },

  hebergeur: {
    nom: 'Vercel Inc.',
    adresse: '440 N Barranca Ave #4133, Covina, CA 91723, États-Unis',
    site: 'https://vercel.com',
  },

  // Durées de conservation annoncées dans la politique de confidentialité
  conservation: {
    demandesMois: 36, // 3 ans après le dernier contact (recommandation CNIL pour la prospection)
    sauvegardesJours: 30,
  },
};
