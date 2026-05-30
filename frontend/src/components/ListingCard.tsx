'use client';

import { Listing } from '@/lib/types';
import PremiumBadge from '@/components/PremiumBadge';
import { getListingOwnerId, LISTING_STATUS_LABELS } from '@/lib/listing-utils';
import { SERVICE_CATEGORIES } from '@/lib/premium/config';

interface Props {
  listing: Listing;
  onAccept?: (id: string) => void;
  onDelete?: (id: string) => void;
  showActions?: boolean;
  currentUserId?: string;
  compact?: boolean;
  deleting?: boolean;
}

const CAT_ICONS = Object.fromEntries(SERVICE_CATEGORIES.map((c) => [c.id, c.icon]));

export default function ListingCard({
  listing,
  onAccept,
  onDelete,
  showActions,
  currentUserId,
  compact,
  deleting,
}: Props) {
  const author = typeof listing.userId === 'object' ? listing.userId : null;
  const ownerId = getListingOwnerId(listing);
  const isOwner = currentUserId && ownerId === currentUserId;
  const st = LISTING_STATUS_LABELS[listing.status] || {
    label: listing.status,
    className: 'bg-gray-600/20 text-gray-400',
  };
  const catIcon = CAT_ICONS[listing.category] || '✨';

  return (
    <article
      className={`listing-card ${listing.featured ? 'listing-card-featured' : ''} ${
        compact ? 'listing-card-compact' : ''
      }`}
    >
      <div className="flex flex-wrap gap-2 mb-3">
        {listing.featured && (
          <span className="badge bg-amber-500/20 text-amber-200 border border-amber-400/40 animate-pulse">
            ★ À la une
          </span>
        )}
        <span
          className={`badge border ${
            listing.type === 'offer'
              ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
              : 'bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/30'
          }`}
        >
          {listing.type === 'offer' ? '📤 Offre' : '📥 Demande'}
        </span>
        <span className="badge bg-violet-500/10 text-violet-300 border border-violet-500/20">
          {catIcon} {listing.category}
        </span>
        {listing.missionType === 'micro-job' && (
          <span className="badge bg-orange-500/15 text-orange-300 border border-orange-500/25">⚡ Micro-job</span>
        )}
        <span className={`badge border ${st.className}`}>{st.label}</span>
      </div>

      <h3 className="text-lg font-bold text-white mb-2 leading-snug">{listing.title}</h3>
      <p className={`text-gray-400 mb-4 ${compact ? 'text-xs line-clamp-2' : 'text-sm line-clamp-3'}`}>
        {listing.description}
      </p>

      {listing.tags?.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {listing.tags.map((t) => (
            <span key={t} className="tag-chip">
              #{t}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <p className="text-2xl font-black bg-gradient-to-r from-cyan-400 to-emerald-400 bg-clip-text text-transparent">
            {listing.price} M
          </p>
          {listing.estimatedDelay && <p className="text-xs text-gray-500">⏱ {listing.estimatedDelay}</p>}
          {author && (
            <p className="text-xs text-gray-500 mt-2 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/5">
                👤 {author.firstname} {author.lastname}
                {author.reputation != null && ` · ★ ${author.reputation}`}
                {author.averageRating ? ` (${author.averageRating}/5)` : ''}
              </span>
              {author.isPremium && <PremiumBadge />}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2 shrink-0">
          {showActions && listing.status === 'open' && onAccept && !isOwner && (
            <button type="button" onClick={() => onAccept(listing._id)} className="btn-primary text-sm">
              Accepter →
            </button>
          )}
          {isOwner && onDelete && listing.status === 'open' && (
            <button
              type="button"
              disabled={deleting}
              onClick={() => {
                if (window.confirm('Retirer cette annonce du marketplace ?')) onDelete(listing._id);
              }}
              className="text-sm px-4 py-2 rounded-lg bg-red-500/20 text-red-300 border border-red-500/40 hover:bg-red-500/30 disabled:opacity-50"
            >
              {deleting ? 'Suppression…' : '🗑 Supprimer'}
            </button>
          )}
          {isOwner && listing.status !== 'open' && (
            <span className="text-xs text-gray-500 text-center">Votre annonce</span>
          )}
        </div>
      </div>
    </article>
  );
}
