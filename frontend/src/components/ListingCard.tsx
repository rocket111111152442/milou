'use client';

import { Listing } from '@/lib/types';

interface Props {
  listing: Listing;
  onAccept?: (id: string) => void;
  showActions?: boolean;
  currentUserId?: string;
}

export default function ListingCard({ listing, onAccept, showActions, currentUserId }: Props) {
  const author = listing.userId;
  const isOwner = currentUserId && author && '_id' in author === false;

  return (
    <article className="card hover:border-cyan-500/30 transition">
      <div className="flex flex-wrap gap-2 mb-3">
        <span className={`badge ${listing.type === 'offer' ? 'bg-cyan-500/10 text-cyan-400' : 'bg-violet-500/10 text-violet-400'}`}>
          {listing.type === 'offer' ? 'Offre' : 'Demande'}
        </span>
        <span className="badge bg-gray-700 text-gray-300">{listing.category}</span>
        <span className={`badge ${listing.status === 'open' ? 'bg-green-500/10 text-green-400' : 'bg-gray-600/20 text-gray-400'}`}>
          {listing.status}
        </span>
      </div>
      <h3 className="text-lg font-semibold text-white mb-2">{listing.title}</h3>
      <p className="text-gray-400 text-sm mb-4 line-clamp-3">{listing.description}</p>
      {listing.tags?.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {listing.tags.map((t) => (
            <span key={t} className="text-xs text-gray-500">#{t}</span>
          ))}
        </div>
      )}
      <div className="flex items-end justify-between">
        <div>
          <p className="text-2xl font-bold text-cyan-400">{listing.price} M</p>
          {listing.estimatedDelay && (
            <p className="text-xs text-gray-500">Délai : {listing.estimatedDelay}</p>
          )}
          {author && (
            <p className="text-xs text-gray-500 mt-1">
              Par {author.firstname} {author.lastname}
              {author.reputation != null && ` · ★ ${author.reputation}`}
            </p>
          )}
        </div>
        {showActions && listing.status === 'open' && onAccept && (
          <button onClick={() => onAccept(listing._id)} className="btn-primary text-sm">
            Accepter
          </button>
        )}
      </div>
    </article>
  );
}
