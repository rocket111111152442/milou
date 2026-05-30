'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import PremiumBadge from '@/components/PremiumBadge';
import { useAuth } from '@/context/AuthContext';

export default function PremiumSuccessPage() {
  const { user, refreshUser, loading } = useAuth();

  useEffect(() => {
    refreshUser();
    const t = setInterval(() => refreshUser(), 3000);
    return () => clearInterval(t);
  }, [refreshUser]);

  return (
    <>
      {user && <Navbar />}
      <main className="max-w-lg mx-auto px-4 py-20 text-center animate-fade-in">
        <div className="card border-amber-500/40 bg-amber-500/10">
          <PremiumBadge size="md" />
          <h1 className="text-2xl font-bold mt-4 text-white">Bienvenue en Premium !</h1>
          <p className="text-gray-400 mt-3 text-sm">
            {loading
              ? 'Activation en cours…'
              : user?.isPremium
                ? 'Votre abonnement est actif. Tous vos avantages sont débloqués.'
                : 'Le paiement est en cours de traitement. Rafraîchissez dans quelques secondes.'}
          </p>
          {user?.premiumExpiresAt && user.isPremium && (
            <p className="text-amber-200/80 text-sm mt-2">
              Jusqu&apos;au {new Date(user.premiumExpiresAt).toLocaleDateString('fr-FR')}
            </p>
          )}
          <div className="flex flex-col sm:flex-row gap-3 justify-center mt-8">
            <Link href="/dashboard" className="btn-primary">
              Voir le dashboard
            </Link>
            <Link href="/create" className="btn-secondary">
              Publier une annonce
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
