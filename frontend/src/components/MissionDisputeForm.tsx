'use client';

import { useState } from 'react';
import { listingsApi } from '@/lib/api';

type Props = {
  missionId: string;
  onDone: () => void;
  onCancel: () => void;
};

export default function MissionDisputeForm({ missionId, onDone, onCancel }: Props) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await listingsApi.disputeMission(missionId, reason.trim());
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 p-3 rounded-xl border border-amber-500/30 bg-amber-500/5 space-y-2">
      <p className="text-xs text-amber-200 font-medium">Pourquoi ne validez-vous pas cette mission ?</p>
      <textarea
        className="input min-h-[100px] text-sm"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Décrivez le problème (travail non conforme, non livré, etc.)"
        required
        minLength={10}
      />
      {error && <p className="text-red-400 text-xs">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="submit" className="btn-primary text-xs py-1.5" disabled={loading || reason.trim().length < 10}>
          {loading ? 'Envoi…' : 'Envoyer à un admin'}
        </button>
        <button type="button" className="btn-secondary text-xs py-1.5" onClick={onCancel} disabled={loading}>
          Annuler
        </button>
      </div>
    </form>
  );
}
