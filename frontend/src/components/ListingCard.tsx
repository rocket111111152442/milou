'use client';

import { Listing } from '@/lib/types';
import PremiumBadge from '@/components/PremiumBadge';
import AdminBadge from '@/components/AdminBadge';
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

const CAT_LABELS = Object.fromEntries(SERVICE_CATEGORIES.map((c) => [c.id, c.label]));

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
    className: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/20',
  };
  const catLabel = CAT_LABELS[listing.category] || listing.category;

  return (
    <article
      className={`listing-card ${listing.featured ? 'listing-card-featured' : ''} ${
        compact ? 'listing-card-compact' : ''
      } group`}
    >
      <div className="flex flex-wrap gap-1.5 mb-3">
        {listing.featured && (
          <span className="badge bg-amber-500/15 text-amber-300 border border-amber-500/25">
            À la une
          </span>
        )}
        <span
          className={`badge border ${
            listing.type === 'offer'
              ? 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20'
              : 'bg-violet-500/10 text-violet-300 border-violet-500/20'
          }`}
        >
          {listing.type === 'offer' ? 'Offre' : 'Demande'}
        </span>
        <span className="badge bg-white/[0.04] text-zinc-400 border border-white/[0.08]">
          {catLabel}
        </span>
        {listing.missionType === 'micro-job' && (
          <span className="badge bg-orange-500/10 text-orange-300 border border-orange-500/20">
            Micro-job
          </span>
        )}
        {listing.isInPerson && (
          <span className="badge bg-teal-500/10 text-teal-300 border border-teal-500/20">
            Présentiel{listing.postalCode ? ` · ${listing.postalCode}` : ''}
          </span>
        )}
        <span className={`badge border ${st.className}`}>{st.label}</span>
      </div>

      <h3 className="text-base font-semibold text-white mb-2 leading-snug group-hover:text-indigo-200 transition">
        {listing.title}
      </h3>
      <p className={`text-zinc-400 mb-4 ${compact ? 'text-xs line-clamp-2' : 'text-sm line-clamp-3'}`}>
        {listing.description}
      </p>

      {listing.tags?.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {listing.tags.map((t) => (
            <span key={t} className="tag-chip">
              {t}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-end justify-between gap-3 flex-wrap pt-3 border-t border-white/[0.04]">
        <div>
          <p className="text-2xl font-bold text-emerald-400 tabular-nums">
            {listing.price}
            <span className="text-sm font-medium text-zinc-500 ml-0.5">M</span>
          </p>
          {listing.estimatedDelay && (
            <p className="text-xs text-zinc-500 mt-0.5">{listing.estimatedDelay}</p>
          )}
          {author && (
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className="text-xs text-zinc-500">
                {author.firstname} {author.lastname}
                {author.reputation != null && ` · ${author.reputation} rep.`}
                {author.averageRating ? ` · ${author.averageRating}/5` : ''}
              </span>
              {author.role === 'admin' && <AdminBadge />}
              {author.isPremium && <PremiumBadge />}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2 shrink-0">
          {showActions && listing.status === 'open' && onAccept && !isOwner && (
            <button type="button" onClick={() => onAccept(listing._id)} className="btn-primary text-sm">
              Accepter
            </button>
          )}
          {isOwner && onDelete && listing.status === 'open' && (
            <button
              type="button"
              disabled={deleting}
              onClick={() => {
                if (window.confirm('Retirer cette annonce du marketplace ?')) onDelete(listing._id);
              }}
              className="btn-danger text-sm"
            >
              {deleting ? 'Suppression…' : 'Supprimer'}
            </button>
          )}
          {isOwner && listing.status !== 'open' && (
            <span className="text-xs text-zinc-600 text-center">Votre annonce</span>
          )}
        </div>
      </div>
    </article>
  );
}
