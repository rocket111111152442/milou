'use client';

import { useState } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import AppShell from '@/components/AppShell';
import { useAuth } from '@/context/AuthContext';
import { codesApi } from '@/lib/api';

export default function CodesPage() {
  const { user, loading, refreshUser } = useAuth();
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [lastRewards, setLastRewards] = useState<string | null>(null);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-cyan-400">Chargement…</div>;
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-milou-bg">
        <div className="card max-w-md text-center">
          <p className="text-4xl mb-4">🎁</p>
          <h1 className="text-xl font-bold mb-2">Codes cadeaux MILOU</h1>
          <p className="text-gray-400 text-sm mb-6">Connectez-vous pour utiliser un code et recevoir des Milou ou du Premium.</p>
          <Link href="/login" className="btn-primary inline-block">
            Se connecter
          </Link>
        </div>
      </div>
    );
  }

  async function handleRedeem(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setMsg('');
    setLastRewards(null);
    setSubmitting(true);
    try {
      const r = await codesApi.redeem(code);
      const parts: string[] = [];
      if (r.rewards.milouAmount) parts.push(`${r.rewards.milouAmount} Milou`);
      if (r.rewards.premiumDays) parts.push(`${r.rewards.premiumDays} jours Premium`);
      if (r.rewards.reputationBonus) parts.push(`+${r.rewards.reputationBonus} réputation`);
      setLastRewards(parts.join(' · ') || 'Récompense activée');
      setMsg(r.message);
      setCode('');
      await refreshUser();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Code invalide');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Navbar />
      <AppShell
        title="Codes cadeaux"
        subtitle="Entrez un code pour gagner des Milou, du Premium ou de la réputation"
        headerRight={
          <span className="text-cyan-400 font-semibold">{user.balance.toFixed(2)} M</span>
        }
      >
        <div className="hero-glow mb-8 max-w-md" />

        <div className="grid lg:grid-cols-2 gap-8 max-w-4xl">
          <form onSubmit={handleRedeem} className="card border-amber-500/30 bg-gradient-to-br from-amber-500/5 to-violet-500/5 space-y-4">
            <p className="text-amber-300 font-semibold">🎟️ Utiliser un code</p>
            <div>
              <label className="label">Votre code</label>
              <input
                className="input text-lg font-mono uppercase tracking-widest text-center"
                placeholder="EX : MILOU2025"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                maxLength={32}
                required
              />
            </div>
            {error && <p className="alert-error py-2 text-sm">{error}</p>}
            {msg && <p className="alert-success py-2 text-sm">{msg}</p>}
            {lastRewards && (
              <p className="text-sm text-violet-300 border border-violet-500/30 rounded-lg px-3 py-2 bg-violet-500/10">
                Récompenses : {lastRewards}
              </p>
            )}
            <button type="submit" className="btn-primary w-full" disabled={submitting || !code.trim()}>
              {submitting ? 'Vérification…' : 'Valider le code'}
            </button>
          </form>

          <div className="space-y-4">
            <div className="card border-cyan-500/20">
              <h3 className="font-semibold text-cyan-300 mb-2">Comment ça marche ?</h3>
              <ul className="text-sm text-gray-400 space-y-2 list-disc list-inside">
                <li>Les codes sont distribués par l&apos;équipe MILOU (événements, partenaires).</li>
                <li>Chaque code a une limite d&apos;utilisations et peut expirer.</li>
                <li>Un même code ne peut souvent être utilisé qu&apos;une fois par compte.</li>
                <li>Les récompenses sont créditées instantanément.</li>
              </ul>
            </div>
            <div className="card border-violet-500/20 text-sm text-gray-500">
              <p>
                Besoin de plus de Milou ? Explorez le{' '}
                <Link href="/marketplace" className="text-cyan-400 hover:underline">
                  marketplace
                </Link>{' '}
                ou passez{' '}
                <Link href="/premium" className="text-amber-400 hover:underline">
                  Premium
                </Link>
                .
              </p>
            </div>
          </div>
        </div>
      </AppShell>
    </>
  );
}
