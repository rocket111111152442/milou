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

export const examplesTotalMilou = MILOU_EXAMPLES.reduce((s, e) => s + e.price, 0);

export const LANDING_SOCIAL_PROOF = {
  headline: 'Des milliers de membres ont déjà rejoint MILOU',
  subline:
    'Étudiants, créatifs et développeurs échangent des services chaque jour — ne restez pas seul.',
  ctaHint: 'Inscription gratuite · Rejoignez la communauté en 30 secondes',
  memberCount: '2 500+',
  memberLabel: 'membres inscrits',
  activeLabel: 'Marketplace actif',
} as const;

export const COMMUNITY_AVATARS = [
  { initials: 'LM', color: 'bg-indigo-500' },
  { initials: 'AK', color: 'bg-emerald-500' },
  { initials: 'SR', color: 'bg-violet-500' },
  { initials: 'TD', color: 'bg-amber-500' },
  { initials: 'NC', color: 'bg-cyan-500' },
] as const;
