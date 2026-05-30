'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
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
        <div className="card border-amber-500/30">
          <p className="text-xs uppercase tracking-[0.25em] text-amber-400/80 font-semibold">Premium MILOU</p>
          <h1 className="text-2xl font-bold mt-3 text-white">Activation en cours</h1>
          <p className="text-zinc-400 mt-3 text-sm leading-relaxed">
            {loading
              ? 'Vérification de votre compte…'
              : user?.isPremium
                ? 'Tout est prêt. Profitez de vos nouveaux avantages sur le marketplace.'
                : 'Le paiement est en cours de traitement. Cette page se met à jour automatiquement.'}
          </p>
          {user?.premiumExpiresAt && user.isPremium && (
            <p className="text-amber-200/80 text-sm mt-2">
              Jusqu&apos;au {new Date(user.premiumExpiresAt).toLocaleDateString('fr-FR')}
            </p>
          )}
          <div className="flex flex-col sm:flex-row gap-3 justify-center mt-8">
            <Link href="/dashboard" className="btn-primary">
              Dashboard
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
