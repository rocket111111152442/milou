'use client';

import Link from 'next/link';
import { Listing } from '@/lib/types';
import { LISTING_STATUS_LABELS } from '@/lib/listing-utils';

interface Props {
  listing: Listing;
  onDelete: (id: string) => void;
  deleting?: boolean;
}

export default function MyListingRow({ listing, onDelete, deleting }: Props) {
  const st = LISTING_STATUS_LABELS[listing.status] || {
    label: listing.status,
    className: 'bg-gray-500/15 text-gray-400',
  };
  const canDelete = listing.status === 'open' || listing.status === 'closed';

  return (
    <li className="my-listing-row group">
      <div className="flex-1 min-w-0">
        <p className="font-medium text-white truncate">{listing.title}</p>
        <div className="flex flex-wrap gap-2 mt-1">
          <span className={`badge border ${st.className}`}>{st.label}</span>
          <span className="text-xs text-emerald-400 tabular-nums">{listing.price} M</span>
          <span className="text-xs text-gray-500 capitalize">{listing.category}</span>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {listing.status === 'open' && (
          <Link href="/marketplace" className="text-xs text-indigo-400 hover:text-indigo-300">
            Voir
          </Link>
        )}
        {canDelete ? (
          <button
            type="button"
            disabled={deleting}
            className="text-xs px-2.5 py-1 rounded-lg bg-red-500/15 text-red-300 border border-red-500/30 hover:bg-red-500/25 disabled:opacity-50"
            onClick={() => {
              if (window.confirm('Supprimer cette annonce du site ? Cette action est définitive.')) {
                onDelete(listing._id);
              }
            }}
          >
            {deleting ? '…' : 'Supprimer'}
          </button>
        ) : (
          <span className="text-xs text-gray-600" title="Mission en cours">
            Mission active
          </span>
        )}
      </div>
    </li>
  );
}
