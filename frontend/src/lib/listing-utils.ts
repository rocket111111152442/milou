import { Listing } from '@/lib/types';

export function getListingOwnerId(listing: Listing): string {
  if (listing.authorId) return listing.authorId;
  if (typeof listing.userId === 'string') return listing.userId;
  return '';
}

export const LISTING_STATUS_LABELS: Record<string, { label: string; className: string }> = {
  draft: { label: 'Brouillon', className: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30' },
  open: { label: 'Disponible', className: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
  in_progress: { label: 'En cours', className: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
  closed: { label: 'Terminée', className: 'bg-gray-500/15 text-gray-400 border-gray-500/30' },
  expired: { label: 'Expirée', className: 'bg-red-500/10 text-red-300 border-red-500/30' },
};
