import { PREMIUM_LIMITS } from './config';

export function premiumExpiresAtToDate(value: unknown): Date | null {
  if (!value) return null;
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    return (value as { toDate: () => Date }).toDate();
  }
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function isPremiumActive(data: Record<string, unknown>): boolean {
  if (!data.isPremium) return false;
  const exp = premiumExpiresAtToDate(data.premiumExpiresAt);
  if (!exp) return Boolean(data.isPremium);
  return exp.getTime() > Date.now();
}

export function getLimitsForUser(data: Record<string, unknown>) {
  return isPremiumActive(data) ? PREMIUM_LIMITS.premium : PREMIUM_LIMITS.free;
}

export { PREMIUM_LIMITS, PREMIUM_FEATURES, SERVICE_CATEGORIES } from './config';
