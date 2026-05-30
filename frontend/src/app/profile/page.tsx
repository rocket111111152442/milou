'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import BalanceCard from '@/components/BalanceCard';
import PremiumBadge from '@/components/PremiumBadge';
import OnlineStatus from '@/components/OnlineStatus';
import { useAuth } from '@/context/AuthContext';
import { reviewsApi, userApi } from '@/lib/api';
import { Listing, Review } from '@/lib/types';

export default function ProfilePage() {
  const { user, loading } = useAuth();
  const [listings, setListings] = useState<Listing[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);

  useEffect(() => {
    if (!user) return;
    userApi.dashboard().then((d) =>
      setListings((d.listings as Listing[]).filter((l) => l.status === 'open'))
    );
    reviewsApi.forUser(user.id).then((r) => setReviews(r.reviews)).catch(() => {});
  }, [user]);

  if (loading || !user) {
    return <div className="min-h-screen flex items-center justify-center text-cyan-400">Chargement...</div>;
  }

  return (
    <>
      <Navbar />
      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6 animate-fade-in">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold">Mon profil</h1>
          {user.isPremium && <PremiumBadge size="md" />}
          <OnlineStatus userId={user.id} />
        </div>

        <BalanceCard balance={user.balance} />

        {!user.isPremium && (
          <Link
            href="/premium"
            className="block card border-amber-500/30 bg-gradient-to-r from-amber-500/10 to-transparent hover:border-amber-400/50 transition"
          >
            <p className="font-semibold text-amber-200">Passer Premium MILOU</p>
            <p className="text-sm text-gray-400 mt-1">Badge, mise en avant, limites étendues</p>
          </Link>
        )}

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Réputation', value: user.reputation, icon: '★' },
            { label: 'Note moyenne', value: user.averageRating ? `${user.averageRating}/5` : '—', icon: '◆' },
            { label: 'Avis reçus', value: user.reviewCount ?? 0, icon: '💬' },
            { label: 'Transactions', value: user.transactionCount, icon: '#' },
          ].map((s) => (
            <div key={s.label} className="card text-center">
              <p className="text-2xl text-cyan-400">
                {s.icon} {s.value}
              </p>
              <p className="text-gray-400 text-sm mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        <div className="card">
          <h2 className="font-semibold mb-4">Informations</h2>
          <dl className="grid sm:grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-gray-500">Nom</dt>
              <dd>
                {user.firstname} {user.lastname}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500">Email</dt>
              <dd>{user.email}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Rôle</dt>
              <dd className="capitalize">{user.role}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Membre depuis</dt>
              <dd>{new Date(user.createdAt).toLocaleDateString('fr-FR')}</dd>
            </div>
            {user.isPremium && user.premiumExpiresAt && (
              <div className="sm:col-span-2">
                <dt className="text-gray-500">Premium jusqu&apos;au</dt>
                <dd className="text-amber-300">
                  {new Date(user.premiumExpiresAt).toLocaleDateString('fr-FR')}
                </dd>
              </div>
            )}
          </dl>
        </div>

        <div className="card">
          <h2 className="font-semibold mb-4">Avis reçus</h2>
          {reviews.length === 0 ? (
            <p className="text-gray-500 text-sm">Aucun avis pour le moment.</p>
          ) : (
            <ul className="space-y-3">
              {reviews.map((r) => (
                <li key={r._id} className="text-sm border-b border-milou-border/50 pb-3">
                  <p className={r.rating === 0 ? 'text-red-400' : 'text-amber-400'}>
                    {r.rating === 0 ? '☆☆☆☆☆ (0/5)' : `${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}`}
                  </p>
                  {r.comment && <p className="text-gray-300 mt-1">{r.comment}</p>}
                  <p className="text-gray-600 text-xs mt-1">
                    {r.from ? `${r.from.firstname} ${r.from.lastname}` : 'Utilisateur'} ·{' '}
                    {new Date(r.createdAt).toLocaleDateString('fr-FR')}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card">
          <h2 className="font-semibold mb-4">Annonces ouvertes</h2>
          {listings.length === 0 ? (
            <p className="text-gray-500 text-sm">Aucune annonce active.</p>
          ) : (
            <ul className="space-y-2">
              {listings.map((l) => (
                <li key={l._id} className="flex justify-between text-sm border-b border-milou-border pb-2">
                  <span>{l.title}</span>
                  <span className="text-cyan-400">{l.price} M</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </>
  );
}
