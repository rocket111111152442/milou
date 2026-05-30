export const MILOU_EXAMPLES = [
  {
    price: 1,
    service: 'Logo simple',
    category: 'Design',
    accent: 'from-emerald-500/20 to-emerald-600/5',
    border: 'border-emerald-500/30',
    priceColor: 'text-emerald-400',
  },
  {
    price: 1,
    service: 'Bannière Discord',
    category: 'Design',
    accent: 'from-teal-500/20 to-teal-600/5',
    border: 'border-teal-500/30',
    priceColor: 'text-teal-400',
  },
  {
    price: 2,
    service: 'Montage court',
    category: 'Vidéo',
    accent: 'from-indigo-500/20 to-indigo-600/5',
    border: 'border-indigo-500/30',
    priceColor: 'text-indigo-400',
  },
  {
    price: 1,
    service: 'Correction de texte',
    category: 'Rédaction',
    accent: 'from-violet-500/20 to-violet-600/5',
    border: 'border-violet-500/30',
    priceColor: 'text-violet-400',
  },
  {
    price: 1,
    service: 'Avatar personnalisé',
    category: 'Design',
    accent: 'from-amber-500/20 to-amber-600/5',
    border: 'border-amber-500/30',
    priceColor: 'text-amber-400',
  },
] as const;

export const SIGNUP_BONUS_MILOU = 10;

/** Somme des exemples affichés — indicatif, les prix réels varient par annonce. */
export const examplesTotalMilou = MILOU_EXAMPLES.reduce((s, e) => s + e.price, 0);

export const LANDING_SOCIAL_PROOF = {
  movement: 'Les premiers membres construisent l\u2019économie MILOU.',
  visitors: 'Déjà 150+ visiteurs ont découvert MILOU.',
} as const;
