import { User } from '@/lib/types';

export type UserBadge = {
  id: string;
  label: string;
  className: string;
};

export function computeReliabilityScore(data: {
  reputation?: number;
  averageRating?: number;
  reviewCount?: number;
  transactionCount?: number;
  totalEarned?: number;
}): number {
  const rep = Number(data.reputation || 0);
  const avg = Number(data.averageRating || 0);
  const reviews = Number(data.reviewCount || 0);
  const txs = Number(data.transactionCount || 0);
  const ratingPart = reviews > 0 ? avg * 12 : 50;
  const activityPart = Math.min(25, txs * 0.5);
  const repPart = Math.min(25, rep * 2);
  return Math.round(Math.min(100, Math.max(0, ratingPart + activityPart + repPart)));
}

export function getUserBadges(user: Pick<User, 'isPremium' | 'role' | 'transactionCount' | 'reviewCount' | 'createdAt'>): UserBadge[] {
  const badges: UserBadge[] = [];
  if (user.role === 'admin') {
    badges.push({ id: 'admin', label: 'Admin', className: 'bg-red-500/15 text-red-300 border-red-500/30' });
  } else if (user.role === 'moderator') {
    badges.push({ id: 'mod', label: 'Modérateur', className: 'bg-orange-500/15 text-orange-300 border-orange-500/30' });
  }
  if (user.isPremium) {
    badges.push({ id: 'premium', label: 'Premium', className: 'bg-amber-500/15 text-amber-300 border-amber-500/30' });
  }
  const txs = Number(user.transactionCount || 0);
  if (txs >= 10) {
    badges.push({ id: 'active', label: '10+ échanges', className: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' });
  }
  const reviews = Number(user.reviewCount || 0);
  if (reviews >= 5) {
    badges.push({ id: 'reviewed', label: '5+ avis reçus', className: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30' });
  }
  const created = user.createdAt ? new Date(user.createdAt).getTime() : 0;
  const yearAgo = Date.now() - 365 * 24 * 60 * 60 * 1000;
  if (created > 0 && created < yearAgo) {
    badges.push({ id: 'veteran', label: 'Membre +1 an', className: 'bg-zinc-500/15 text-zinc-300 border-zinc-500/30' });
  }
  return badges;
}

export function publicUserFields(id: string, data: Record<string, unknown>) {
  const reliabilityScore = computeReliabilityScore({
    reputation: Number(data.reputation || 0),
    averageRating: Number(data.averageRating || 0),
    reviewCount: Number(data.reviewCount || 0),
    transactionCount: Number(data.transactionCount || 0),
    totalEarned: Number(data.totalEarned || 0),
  });
  return {
    id,
    firstname: String(data.firstname || ''),
    lastname: String(data.lastname || ''),
    postalCode: String(data.postalCode || ''),
    bio: String(data.bio || ''),
    skills: Array.isArray(data.skills) ? data.skills.map(String).slice(0, 12) : [],
    avatarUrl: String(data.avatarUrl || ''),
    reputation: Number(data.reputation || 0),
    reviewCount: Number(data.reviewCount || 0),
    averageRating: Number(data.averageRating || 0),
    transactionCount: Number(data.transactionCount || 0),
    isPremium: Boolean(data.isPremium),
    role: String(data.role || 'user'),
    createdAt: data.createdAt,
    reliabilityScore,
  };
}
