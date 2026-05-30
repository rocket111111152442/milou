'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import Navbar from '@/components/Navbar';
import FreeVsPremiumTable from '@/components/FreeVsPremiumTable';
import PremiumBadge from '@/components/PremiumBadge';
import { useAuth } from '@/context/AuthContext';
import { premiumApi } from '@/lib/api';
import type { PremiumUsage } from '@/lib/types';

const PRICE_LABEL = process.env.NEXT_PUBLIC_STRIPE_PRICE_LABEL || '4,99 € / mois';

export default function PremiumPage() {
  const { user, loading, refreshUser } = useAuth();
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

  return (
    <>
      {user && <Navbar />}
      <main className="max-w-4xl mx-auto px-4 py-10 sm:py-14 animate-fade-in">
        <div className="text-center mb-10">
          <PremiumBadge size="md" />
          <h1 className="text-3xl sm:text-4xl font-bold mt-4 bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-400 bg-clip-text text-transparent">
            Premium MILOU
          </h1>
          <p className="text-gray-400 mt-3 max-w-xl mx-auto">
            Débloquez la mise en avant, des limites plus hautes et une expérience complète sur la
            marketplace étudiante & communautaire.
          </p>
        </div>

        {user?.isPremium ? (
          <div className="card border-amber-500/30 bg-amber-500/10 text-center mb-8">
            <p className="text-amber-200 font-semibold">Vous êtes déjà Premium MILOU</p>
            {user.premiumExpiresAt && (
              <p className="text-sm text-gray-400 mt-2">
                Valide jusqu&apos;au {new Date(user.premiumExpiresAt).toLocaleDateString('fr-FR')}
              </p>
            )}
            <Link href="/dashboard" className="btn-primary inline-block mt-4">
              Retour au dashboard
            </Link>
          </div>
        ) : (
          <div className="card text-center mb-8 border-violet-500/20 bg-gradient-to-br from-violet-500/10 to-cyan-500/5">
            <p className="text-4xl font-bold text-white mb-1">{PRICE_LABEL}</p>
            <p className="text-gray-400 text-sm mb-6">Annulable à tout moment · Paiement sécurisé Stripe</p>
            <button
              type="button"
              className="btn-primary text-lg px-10 py-3 bg-gradient-to-r from-amber-500 to-yellow-500 hover:opacity-95"
              onClick={handleCheckout}
              disabled={checkoutLoading}
            >
              {checkoutLoading ? 'Redirection…' : user ? 'Passer Premium' : 'Connexion puis Premium'}
            </button>
            {error && <p className="text-milou-danger text-sm mt-4">{error}</p>}
          </div>
        )}

        {usage && !user?.isPremium && (
          <div className="grid sm:grid-cols-3 gap-3 mb-8 text-sm">
            <div className="card py-3 text-center">
              <p className="text-gray-500">Annonces ce mois</p>
              <p className="text-xl font-bold text-cyan-400">
                {usage.usage.listingsThisMonth}/{usage.limits.maxListingsPerMonth}
              </p>
            </div>
            <div className="card py-3 text-center">
              <p className="text-gray-500">Transferts aujourd&apos;hui</p>
              <p className="text-xl font-bold text-cyan-400">
                {usage.usage.transfersToday}/{usage.limits.maxTransfersPerDay}
              </p>
            </div>
            <div className="card py-3 text-center">
              <p className="text-gray-500">Missions actives</p>
              <p className="text-xl font-bold text-cyan-400">
                {usage.usage.activeMissions}/{usage.limits.maxActiveMissions}
              </p>
            </div>
          </div>
        )}

        <h2 className="text-xl font-semibold mb-4 text-center">Gratuit vs Premium</h2>
        <FreeVsPremiumTable />

        <p className="text-center text-gray-600 text-xs mt-8">
          Milou reste une monnaie fictive. Premium débloque des fonctionnalités plateforme, pas de l&apos;argent réel.
        </p>
      </main>
    </>
  );
}
