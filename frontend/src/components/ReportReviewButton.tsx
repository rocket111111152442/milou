'use client';

import { useState } from 'react';
import { reviewsApi } from '@/lib/api';

const REASONS = [
  { id: 'injuste', label: 'Avis injuste ou faux' },
  { id: 'harcelement', label: 'Insulte / harcèlement' },
  { id: 'hors_sujet', label: 'Pas lié à la mission' },
  { id: 'erreur', label: 'Erreur (mauvaise personne)' },
  { id: 'autre', label: 'Autre' },
] as const;

interface Props {
  reviewId: string;
  onReported?: () => void;
}

export default function ReportReviewButton({ reviewId, onReported }: Props) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string>('injuste');
  const [details, setDetails] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await reviewsApi.report(reviewId, { reason, details });
      setDone(true);
      onReported?.();
      setTimeout(() => setOpen(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return <p className="text-xs text-emerald-400 mt-2">Signalement envoyé aux modérateurs.</p>;
  }

  return (
    <>
      <button
        type="button"
        className="text-xs text-amber-400/90 hover:text-amber-300 mt-2 underline"
        onClick={() => {
          setOpen(true);
          setError('');
        }}
      >
        Signaler cet avis
      </button>

      {open && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/70"
            aria-label="Fermer"
            onClick={() => setOpen(false)}
          />
          <form
            onSubmit={handleSubmit}
            className="relative w-full max-w-md card border-amber-500/30 space-y-4"
          >
            <h3 className="font-semibold text-amber-300">Signaler un avis</h3>
            <p className="text-xs text-gray-400">
              Décrivez le problème. Un modérateur examinera votre signalement et pourra supprimer l&apos;avis.
            </p>
            <div>
              <label className="label">Motif</label>
              <select className="input text-sm" value={reason} onChange={(e) => setReason(e.target.value)}>
                {REASONS.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Détails</label>
              <textarea
                className="input min-h-[100px] text-sm"
                placeholder="Expliquez pourquoi cet avis devrait être examiné…"
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                required
                minLength={10}
                maxLength={1000}
              />
            </div>
            {error && <p className="text-milou-danger text-xs">{error}</p>}
            <div className="flex gap-2">
              <button type="button" className="btn-secondary flex-1 text-sm" onClick={() => setOpen(false)}>
                Annuler
              </button>
              <button type="submit" className="btn-primary flex-1 text-sm" disabled={loading}>
                {loading ? 'Envoi…' : 'Envoyer au modérateur'}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
