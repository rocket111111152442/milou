'use client';

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { formatAuthError } from '@/lib/firebase/errors';
import { getFirebaseAuth } from '@/lib/firebase/client';

export default function CompletePostalCode() {
  const { user, refreshUser } = useAuth();
  const [postalCode, setPostalCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const token = await getFirebaseAuth().currentUser?.getIdToken();
      if (!token) throw new Error('Session expirée. Reconnectez-vous.');

      const res = await fetch('/api/auth/postal-code', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ postalCode: postalCode.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur');

      await refreshUser();
    } catch (err) {
      setError(formatAuthError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 bg-milou-bg">
      <div className="card max-w-md w-full">
        <h1 className="text-xl font-bold mb-2 text-white">Votre code postal</h1>
        <p className="text-gray-400 text-sm mb-6">
          {user?.firstname ? `${user.firstname}, ` : ''}
          nous avons ajouté les alertes pour les missions près de chez vous. Indiquez votre code postal pour
          continuer à utiliser MILOU.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Code postal</label>
            <input
              className="input"
              value={postalCode}
              onChange={(e) => setPostalCode(e.target.value)}
              required
              inputMode="numeric"
              autoComplete="postal-code"
              placeholder="Ex : 75001"
              maxLength={10}
            />
            <p className="text-xs text-zinc-500 mt-1">
              5 chiffres — utilisé pour vous prévenir des annonces en présentiel dans votre zone.
            </p>
          </div>
          {error && <p className="text-milou-danger text-sm">{error}</p>}
          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? 'Enregistrement…' : 'Continuer'}
          </button>
        </form>
      </div>
    </main>
  );
}
