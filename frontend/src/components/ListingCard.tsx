'use client';

import { Listing } from '@/lib/types';
import PremiumBadge from '@/components/PremiumBadge';

interface Props {
  listing: Listing;
  onAccept?: (id: string) => void;
  showActions?: boolean;
  currentUserId?: string;
}

export default function ListingCard({ listing, onAccept, showActions }: Props) {
  const author = listing.userId;

  return (
    <article
      className={`card hover:border-cyan-500/30 transition animate-fade-in ${
        listing.featured ? 'border-amber-500/30 ring-1 ring-amber-500/20' : ''
      }`}
    >
      <div className="flex flex-wrap gap-2 mb-3">
        {listing.featured && (
          <span className="badge bg-amber-500/15 text-amber-300 border border-amber-500/30">
            ★ Mise en avant
          </span>
        )}
        <span
          className={`badge ${
            listing.type === 'offer' ? 'bg-cyan-500/10 text-cyan-400' : 'bg-violet-500/10 text-violet-400'
          }`}
        >
          {listing.type === 'offer' ? 'Offre' : 'Demande'}
        </span>
        <span className="badge bg-gray-700 text-gray-300">{listing.category}</span>
        {listing.missionType === 'micro-job' && (
          <span className="badge bg-orange-500/10 text-orange-300">Micro-job</span>
        )}
        <span
          className={`badge ${
            listing.status === 'open' ? 'bg-green-500/10 text-green-400' : 'bg-gray-600/20 text-gray-400'
          }`}
        >
          {listing.status}
        </span>
      </div>
      <h3 className="text-lg font-semibold text-white mb-2">{listing.title}</h3>
      <p className="text-gray-400 text-sm mb-4 line-clamp-3">{listing.description}</p>
      {listing.tags?.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {listing.tags.map((t) => (
            <span key={t} className="text-xs text-gray-500">
              #{t}
            </span>
          ))}
        </div>
      )}
      <div className="flex items-end justify-between gap-2">
        <div>
          <p className="text-2xl font-bold text-cyan-400">{listing.price} M</p>
          {listing.estimatedDelay && (
            <p className="text-xs text-gray-500">Délai : {listing.estimatedDelay}</p>
          )}
          {author && (
            <p className="text-xs text-gray-500 mt-1 flex flex-wrap items-center gap-2">
              <span>
                Par {author.firstname} {author.lastname}
                {author.reputation != null && ` · ★ ${author.reputation}`}
                {author.averageRating ? ` (${author.averageRating}/5)` : ''}
              </span>
              {author.isPremium && <PremiumBadge />}
            </p>
          )}
        </div>
        {showActions && listing.status === 'open' && onAccept && (
          <button type="button" onClick={() => onAccept(listing._id)} className="btn-primary text-sm shrink-0">
            Accepter
          </button>
        )}
      </div>
    </article>
  );
}
