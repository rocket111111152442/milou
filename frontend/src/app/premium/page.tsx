'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import Navbar from '@/components/Navbar';
import AppShell from '@/components/AppShell';
import FreeVsPremiumTable from '@/components/FreeVsPremiumTable';
import PremiumBadge from '@/components/PremiumBadge';
import { useAuth } from '@/context/AuthContext';
import { premiumApi } from '@/lib/api';
import type { PremiumUsage } from '@/lib/types';
import { IconCheck, IconStar } from '@/components/ui/Icons';

const PRICE_LABEL = process.env.NEXT_PUBLIC_STRIPE_PRICE_LABEL || '4,99 € / mois';

export default function PremiumPage() {
  const { user, loading } = useAuth();
  const searchParams = useSearchParams();
  const [usage, setUsage] = useState<PremiumUsage | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) premiumApi.usage().then(setUsage).catch(() => {});
  }, [user]);

  useEffect(() => {
    if (searchParams.get('canceled')) setError('Paiement annulé. Vous pouvez réessayer quand vous voulez.');
  }, [searchParams]);

  async function handleCheckout() {
    if (!user) {
      window.location.href = '/login?redirect=/premium';
      return;
    }
    setCheckoutLoading(true);
    setError('');
    try {
      const { url } = await premiumApi.checkout();
      if (url) window.location.href = url;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Impossible de démarrer le paiement');
      setCheckoutLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-milou-bg">
        <p className="text-zinc-500 text-sm">Chargement…</p>
      </div>
    );
  }

  return (
    <>
      {user && <Navbar />}
      <AppShell
        title="Premium MILOU"
        subtitle="Limites étendues, mise en avant et badge exclusif"
        headerRight={user?.isPremium ? <PremiumBadge size="md" /> : undefined}
      >
        <div className="max-w-3xl mx-auto space-y-8 animate-fade-up">
          {user?.isPremium ? (
            <div className="card border-amber-500/25 bg-amber-500/5 text-center">
              <IconStar className="w-8 h-8 text-amber-400 mx-auto mb-3" />
              <p className="text-white font-semibold text-lg">Vous êtes Premium MILOU</p>
              {user.premiumExpiresAt && (
                <p className="text-sm text-zinc-400 mt-2">
                  Valide jusqu&apos;au {new Date(user.premiumExpiresAt).toLocaleDateString('fr-FR')}
                </p>
              )}
              <Link href="/dashboard" className="btn-primary inline-flex mt-6">
                Retour au dashboard
              </Link>
            </div>
          ) : (
            <div className="card text-center border-indigo-500/20">
              <p className="text-4xl font-bold text-white tracking-tight">{PRICE_LABEL}</p>
              <p className="text-zinc-400 text-sm mt-2">Annulable à tout moment · Paiement sécurisé Stripe</p>
              <ul className="mt-6 space-y-2 text-sm text-zinc-400 text-left max-w-xs mx-auto">
                {['25 annonces / mois', 'Transferts étendus', 'Mise en avant auto', 'Badge Premium'].map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <IconCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className="btn-primary text-base px-10 py-3 mt-8 bg-amber-600 hover:bg-amber-500"
                onClick={handleCheckout}
                disabled={checkoutLoading}
              >
                {checkoutLoading ? 'Redirection…' : user ? 'Passer Premium' : 'Connexion puis Premium'}
              </button>
              {error && <p className="text-red-400 text-sm mt-4">{error}</p>}
            </div>
          )}

          {usage && !user?.isPremium && (
            <div className="grid sm:grid-cols-3 gap-4">
              {[
                { label: 'Annonces ce mois', val: `${usage.usage.listingsThisMonth}/${usage.limits.maxListingsPerMonth}` },
                { label: 'Transferts aujourd\'hui', val: `${usage.usage.transfersToday}/${usage.limits.maxTransfersPerDay}` },
                { label: 'Missions actives', val: `${usage.usage.activeMissions}/${usage.limits.maxActiveMissions}` },
              ].map((s) => (
                <div key={s.label} className="card py-4 text-center">
                  <p className="text-xs text-zinc-500 uppercase tracking-wide">{s.label}</p>
                  <p className="text-xl font-bold text-white tabular-nums mt-1">{s.val}</p>
                </div>
              ))}
            </div>
          )}

          <div>
            <h2 className="text-lg font-semibold text-white mb-4 text-center">Gratuit vs Premium</h2>
            <FreeVsPremiumTable />
          </div>

          <p className="text-center text-zinc-600 text-xs">
            Milou reste une monnaie fictive. Premium débloque des fonctionnalités plateforme, pas de l&apos;argent réel.
          </p>
        </div>
      </AppShell>
    </>
  );
}
