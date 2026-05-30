export const MILOU_EXAMPLES = [
  {
    price: 1,
    service: "Création d'un logo",
    category: 'Design',
    accent: 'from-emerald-500/20 to-emerald-600/5',
    border: 'border-emerald-500/30',
    priceColor: 'text-emerald-400',
  },
  {
    price: 3,
    service: 'Montage vidéo',
    category: 'Vidéo',
    accent: 'from-indigo-500/20 to-indigo-600/5',
    border: 'border-indigo-500/30',
    priceColor: 'text-indigo-400',
  },
  {
    price: 5,
    service: "Développement d'un bot Discord",
    category: 'Dev',
    accent: 'from-violet-500/20 to-violet-600/5',
    border: 'border-violet-500/30',
    priceColor: 'text-violet-400',
  },
] as const;

export const SIGNUP_BONUS_MILOU = 10;

export const examplesTotalMilou = MILOU_EXAMPLES.reduce((s, e) => s + e.price, 0);
