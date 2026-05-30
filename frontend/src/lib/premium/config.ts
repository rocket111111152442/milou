/** Limites Free vs Premium MILOU */
export const PREMIUM_LIMITS = {
  free: {
    maxListingsPerMonth: 3,
    maxTransfersPerDay: 5,
    maxActiveMissions: 2,
    maxTransferAmount: 50,
    marketplaceBoost: 0,
  },
  premium: {
    maxListingsPerMonth: 25,
    maxTransfersPerDay: 999,
    maxActiveMissions: 15,
    maxTransferAmount: 500,
    marketplaceBoost: 100,
  },
} as const;

export const PREMIUM_FEATURES = [
  { id: 'badge', label: 'Badge Premium sur le profil', free: false, premium: true },
  { id: 'boost', label: 'Annonces mises en avant marketplace', free: false, premium: true },
  { id: 'priority', label: 'Priorité dans les résultats', free: false, premium: true },
  { id: 'listings', label: 'Annonces / mois', free: '3', premium: '25' },
  { id: 'transfers', label: 'Transferts / jour', free: '5', premium: 'Illimité' },
  { id: 'missions', label: 'Missions actives', free: '2', premium: '15' },
  { id: 'amount', label: 'Plafond transfert (M)', free: '50', premium: '500' },
  { id: 'analytics', label: 'Statistiques avancées dashboard', free: false, premium: true },
  { id: 'support', label: 'Support prioritaire', free: false, premium: true },
];

export const SERVICE_CATEGORIES = [
  { id: 'devoirs', label: 'Aide aux devoirs', icon: '📚' },
  { id: 'redaction', label: 'Rédaction / correction', icon: '✍️' },
  { id: 'design', label: 'Design simple', icon: '🎨' },
  { id: 'informatique', label: 'Aide informatique', icon: '💻' },
  { id: 'micro-job', label: 'Mission rapide (micro-job)', icon: '⚡' },
  { id: 'services', label: 'Petits services', icon: '🤝' },
  { id: 'dev', label: 'Développement', icon: '⌨️' },
  { id: 'coaching', label: 'Coaching', icon: '🎯' },
  { id: 'autre', label: 'Autre', icon: '✨' },
] as const;
