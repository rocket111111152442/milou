'use client';

import { useCallback, useEffect, useState } from 'react';
import { reviewsApi } from '@/lib/api';
import { Review } from '@/lib/types';
import { IconStar } from '@/components/ui/Icons';
import ReportReviewButton from '@/components/ReportReviewButton';
import ReviewSummary from './ReviewSummary';
import ReviewCard from './ReviewCard';

const PAGE = 5;
type Filter = 'all' | 5 | 4 | 3 | 'low';

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'Tous' },
  { id: 5, label: '5 ★' },
  { id: 4, label: '4 ★' },
  { id: 3, label: '3 ★' },
  { id: 'low', label: '1-2 ★' },
];

interface Props {
  userId: string;
  /** Valeurs officielles stockées sur le profil */
  averageRating: number;
  reviewCount: number;
  /** Le destinataire peut signaler les avis reçus */
  canReport?: boolean;
  title?: string;
}

export default function ReviewsSection({
  userId,
  averageRating,
  reviewCount,
  canReport = false,
  title = 'Avis reçus',
}: Props) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [distribution, setDistribution] = useState<number[]>([0, 0, 0, 0, 0, 0]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [visible, setVisible] = useState(PAGE);

  const load = useCallback(() => {
    setError('');
    return reviewsApi
      .forUser(userId)
      .then((r) => {
        setReviews(r.reviews);
        setDistribution(r.distribution);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Impossible de charger les avis'))
      .finally(() => setLoading(false));
  }, [userId]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const filtered = reviews.filter((r) => {
    if (filter === 'all') return true;
    if (filter === 'low') return r.rating <= 2;
    return r.rating === filter;
  });

  // Le profil fait foi ; repli sur les avis chargés si les compteurs sont désynchronisés.
  const analysed = distribution.reduce((a, b) => a + b, 0);
  const count = reviewCount > 0 ? reviewCount : analysed;
  const average =
    reviewCount > 0 || !analysed
      ? averageRating
      : distribution.reduce((sum, c, rating) => sum + c * rating, 0) / analysed;

  return (
    <section className="card" aria-labelledby={`reviews-${userId}`}>
      <div className="flex items-center justify-between gap-3 mb-5">
        <h2 id={`reviews-${userId}`} className="text-lg font-semibold text-white flex items-center gap-2">
          <IconStar className="w-4 h-4 text-amber-400" />
          {title}
        </h2>
        {count > 0 && <span className="text-xs text-zinc-500 tabular-nums">{count} au total</span>}
      </div>

      {loading ? (
        <div className="space-y-3" aria-busy="true">
          <div className="h-32 rounded-2xl bg-milou-surface/60 border border-white/[0.06] animate-pulse" />
          {[0, 1].map((i) => (
            <div key={i} className="h-24 rounded-xl bg-milou-surface/40 border border-white/[0.04] animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="alert-error justify-between">
          <span>{error}</span>
          <button type="button" className="text-xs underline" onClick={() => load()}>
            Réessayer
          </button>
        </div>
      ) : reviews.length === 0 ? (
        <div className="flex flex-col items-center text-center py-8">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-3">
            <IconStar className="w-6 h-6 text-amber-400/70" />
          </div>
          <p className="text-sm text-zinc-300 font-medium">Aucun avis pour le moment</p>
          <p className="text-xs text-zinc-500 mt-1 max-w-xs">
            Les avis apparaissent ici après chaque mission terminée sur MILOU.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          <ReviewSummary average={average} count={count} distribution={distribution} />

          {reviews.length > 3 && (
            <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filtrer les avis">
              {FILTERS.map((f) => (
                <button
                  key={String(f.id)}
                  type="button"
                  role="tab"
                  aria-selected={filter === f.id}
                  onClick={() => {
                    setFilter(f.id);
                    setVisible(PAGE);
                  }}
                  className={`text-xs px-3 py-1.5 rounded-lg ${filter === f.id ? 'chip chip-active' : 'chip'}`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          )}

          {filtered.length === 0 ? (
            <p className="text-sm text-zinc-500 text-center py-4">Aucun avis avec ce filtre.</p>
          ) : (
            <ul className="space-y-3">
              {filtered.slice(0, visible).map((r) => (
                <li key={r._id} className="animate-fade-in">
                  <ReviewCard
                    review={r}
                    actions={
                      canReport && !r.autoPenalty ? <ReportReviewButton reviewId={r._id} /> : undefined
                    }
                  />
                </li>
              ))}
            </ul>
          )}

          {filtered.length > visible && (
            <button
              type="button"
              className="btn-secondary w-full"
              onClick={() => setVisible((v) => v + PAGE)}
            >
              Voir plus d&apos;avis ({filtered.length - visible})
            </button>
          )}
        </div>
      )}
    </section>
  );
}
