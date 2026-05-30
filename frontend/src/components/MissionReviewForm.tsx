'use client';

import { useState } from 'react';
import { reviewsApi } from '@/lib/api';

export default function MissionReviewForm({
  missionId,
  onDone,
}: {
  missionId: string;
  onDone?: () => void;
}) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg('');
    try {
      await reviewsApi.create({ missionId, rating, comment });
      setMsg('Merci pour votre avis !');
      onDone?.();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-3 p-3 rounded-lg bg-milou-bg border border-milou-border space-y-2">
      <p className="text-xs text-gray-400">Laisser un avis sur cette mission</p>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            className={`text-lg ${n <= rating ? 'text-amber-400' : 'text-gray-600'}`}
            onClick={() => setRating(n)}
          >
            ★
          </button>
        ))}
      </div>
      <input
        className="input text-sm"
        placeholder="Commentaire (optionnel)"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
      />
      <button type="submit" className="btn-secondary text-xs w-full" disabled={loading}>
        Envoyer l&apos;avis
      </button>
      {msg && <p className="text-xs text-cyan-400">{msg}</p>}
    </form>
  );
}
