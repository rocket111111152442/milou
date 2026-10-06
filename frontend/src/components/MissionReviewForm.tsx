'use client';

import { useState } from 'react';
import { reviewsApi } from '@/lib/api';
import { REVIEW_COMMENT_MAX } from '@/lib/review-constants';
import StarRatingInput from '@/components/reviews/StarRatingInput';

export default function MissionReviewForm({
  missionId,
  partnerName,
  onDone,
}: {
  missionId: string;
  /** Nom de la personne évaluée (affiché dans le libellé) */
  partnerName?: string;
  onDone?: () => void;
}) {
  // Pas de note par défaut : une note pré-remplie à 5 biaise les avis.
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!rating) {
      setError('Choisissez une note avant d\'envoyer.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await reviewsApi.create({ missionId, rating, comment: comment.trim() });
      setSent(true);
      onDone?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="mt-3 alert-success justify-center">
        <span aria-hidden>✓</span> Merci, votre avis a bien été publié.
      </div>
    );
  }

  const remaining = REVIEW_COMMENT_MAX - comment.length;
  const lowRating = rating > 0 && rating <= 2;

  return (
    <form
      onSubmit={submit}
      className="mt-3 p-4 rounded-xl bg-milou-surface/60 border border-white/[0.06] space-y-4"
    >
      <p className="text-sm text-zinc-300 text-center">
        Comment s&apos;est passée la mission
        {partnerName ? (
          <>
            {' '}avec <strong className="text-white font-medium">{partnerName}</strong>
          </>
        ) : null}{' '}
        ?
      </p>

      <StarRatingInput
        value={rating}
        onChange={(n) => {
          setRating(n);
          setError('');
        }}
        disabled={loading}
      />

      <div>
        <label htmlFor={`review-comment-${missionId}`} className="label text-xs">
          Votre commentaire {lowRating ? '(recommandé)' : '(optionnel)'}
        </label>
        <textarea
          id={`review-comment-${missionId}`}
          className="input min-h-[88px] resize-y text-sm"
          placeholder={
            lowRating
              ? 'Expliquez ce qui n\'a pas fonctionné, de façon factuelle…'
              : 'Qualité du travail, communication, respect du délai…'
          }
          value={comment}
          maxLength={REVIEW_COMMENT_MAX}
          onChange={(e) => setComment(e.target.value)}
          disabled={loading}
        />
        <p className={`text-[11px] text-right mt-1 tabular-nums ${remaining < 50 ? 'text-amber-400' : 'text-zinc-600'}`}>
          {remaining} caractères restants
        </p>
      </div>

      {error && <p className="alert-error text-xs">{error}</p>}

      <button type="submit" className="btn-primary w-full" disabled={loading || !rating}>
        {loading ? 'Publication…' : 'Publier mon avis'}
      </button>
      <p className="text-[11px] text-zinc-600 text-center">
        Votre avis est public et définitif. Restez factuel et respectueux.
      </p>
    </form>
  );
}
