import Link from 'next/link';
import { ReactNode } from 'react';
import { Review } from '@/lib/types';
import { RATING_LABELS } from '@/lib/review-constants';
import StarRating from './StarRating';

const rtf = new Intl.RelativeTimeFormat('fr', { numeric: 'auto' });

function relativeDate(iso: string) {
  const diff = (new Date(iso).getTime() - Date.now()) / 1000;
  const abs = Math.abs(diff);
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
  if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), 'day');
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

function Avatar({ review }: { review: Review }) {
  const from = review.from;
  if (review.autoPenalty) {
    return (
      <div className="w-10 h-10 rounded-full shrink-0 flex items-center justify-center bg-red-500/10 border border-red-500/25 text-red-400 text-sm font-bold">
        !
      </div>
    );
  }
  if (from?.avatarUrl) {
    return (
      <img
        src={from.avatarUrl}
        alt=""
        referrerPolicy="no-referrer"
        className="w-10 h-10 rounded-full shrink-0 object-cover border border-white/10"
      />
    );
  }
  const initials = from
    ? `${from.firstname.charAt(0)}${from.lastname.charAt(0)}`.toUpperCase() || '?'
    : '?';
  return (
    <div className="w-10 h-10 rounded-full shrink-0 flex items-center justify-center text-sm font-semibold text-white bg-gradient-to-br from-indigo-500 to-indigo-700 border border-white/10">
      {initials}
    </div>
  );
}

interface Props {
  review: Review;
  /** Actions supplémentaires (ex. bouton de signalement) */
  actions?: ReactNode;
}

export default function ReviewCard({ review, actions }: Props) {
  const name = review.autoPenalty
    ? 'MILOU — automatique'
    : review.from
      ? `${review.from.firstname} ${review.from.lastname.charAt(0)}.`.trim()
      : 'Utilisateur supprimé';

  return (
    <article
      className={`p-4 rounded-xl border transition ${
        review.autoPenalty
          ? 'bg-red-500/[0.04] border-red-500/20'
          : 'bg-milou-surface/60 border-white/[0.06] hover:border-white/10'
      }`}
    >
      <header className="flex items-start gap-3">
        <Avatar review={review} />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {review.from && !review.autoPenalty ? (
              <Link
                href={`/profile/${review.from.id}`}
                className="text-sm font-medium text-zinc-100 hover:text-indigo-300 transition truncate"
              >
                {name}
              </Link>
            ) : (
              <span className="text-sm font-medium text-zinc-300">{name}</span>
            )}
            {review.from?.isPremium && !review.autoPenalty && (
              <span className="badge bg-amber-500/10 text-amber-300 border border-amber-500/20 text-[10px] py-0">
                Premium
              </span>
            )}
            <span className="text-xs text-zinc-600">·</span>
            <time dateTime={review.createdAt} className="text-xs text-zinc-500">
              {relativeDate(review.createdAt)}
            </time>
          </div>
          <div className="flex items-center gap-2 mt-1">
            {review.autoPenalty ? (
              <span className="badge bg-red-500/10 text-red-400 border border-red-500/20">
                0/5 · Délai non respecté
              </span>
            ) : (
              <>
                <StarRating value={review.rating} />
                <span className="text-xs text-zinc-400">{RATING_LABELS[review.rating]}</span>
              </>
            )}
          </div>
        </div>
      </header>

      {review.comment && !review.autoPenalty && (
        <p className="text-sm text-zinc-300 mt-3 leading-relaxed whitespace-pre-line break-words">
          {review.comment}
        </p>
      )}
      {review.autoPenalty && (
        <p className="text-sm text-zinc-400 mt-3">
          La mission n&apos;a pas été livrée dans le délai annoncé. Le client a été remboursé automatiquement.
        </p>
      )}

      {(review.listingTitle || actions) && (
        <footer className="flex flex-wrap items-center justify-between gap-2 mt-3 pt-3 border-t border-white/[0.04]">
          {review.listingTitle ? (
            <span className="tag-chip truncate max-w-full">Mission : {review.listingTitle}</span>
          ) : (
            <span />
          )}
          {actions}
        </footer>
      )}
    </article>
  );
}
