'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import AppShell from '@/components/AppShell';
import BalanceCard from '@/components/BalanceCard';
import PremiumBadge from '@/components/PremiumBadge';
import OnlineStatus from '@/components/OnlineStatus';
import { useAuth } from '@/context/AuthContext';
import { reviewsApi, userApi } from '@/lib/api';
import ReportReviewButton from '@/components/ReportReviewButton';
import { Listing, Review } from '@/lib/types';
import { IconArrowRight, IconStar } from '@/components/ui/Icons';

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
    return (
      <div className="min-h-screen flex items-center justify-center bg-milou-bg">
        <p className="text-zinc-500 text-sm">Chargement…</p>
      </div>
    );
  }

  const stats = [
    { label: 'Réputation', value: user.reputation },
    { label: 'Note moyenne', value: user.averageRating ? `${user.averageRating}/5` : '—' },
    { label: 'Avis reçus', value: user.reviewCount ?? 0 },
    { label: 'Transactions', value: user.transactionCount },
  ];

  return (
    <>
      <Navbar />
      <AppShell
        title="Mon profil"
        subtitle={`${user.firstname} ${user.lastname} · membre depuis ${new Date(user.createdAt).toLocaleDateString('fr-FR')}`}
        headerRight={
          <div className="flex items-center gap-2">
            {user.isPremium && <PremiumBadge size="md" />}
            <OnlineStatus userId={user.id} />
          </div>
        }
      >
        <div className="space-y-6 animate-fade-up">
          <BalanceCard balance={user.balance} />

          {!user.isPremium && (
            <Link
              href="/premium"
              className="card-interactive flex items-center justify-between group border-amber-500/20 bg-amber-500/5"
            >
              <div>
                <p className="font-semibold text-white flex items-center gap-2">
                  <IconStar className="w-4 h-4 text-amber-400" />
                  Passer Premium MILOU
                </p>
                <p className="text-sm text-zinc-400 mt-1">Badge, mise en avant, limites étendues</p>
              </div>
              <IconArrowRight className="w-5 h-5 text-zinc-500 group-hover:text-white transition" />
            </Link>
          )}

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {stats.map((s) => (
              <div key={s.label} className="card py-4 text-center">
                <p className="text-2xl font-bold text-white tabular-nums">{s.value}</p>
                <p className="text-zinc-500 text-xs mt-1 uppercase tracking-wide">{s.label}</p>
              </div>
            ))}
          </div>

          <div className="card">
            <h2 className="font-semibold text-white mb-4">Informations</h2>
            <dl className="grid sm:grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-zinc-500 text-xs uppercase tracking-wide mb-1">Nom</dt>
                <dd className="text-white">
                  {user.firstname} {user.lastname}
                </dd>
              </div>
              <div>
                <dt className="text-zinc-500 text-xs uppercase tracking-wide mb-1">Email</dt>
                <dd className="text-white">{user.email}</dd>
              </div>
              <div>
                <dt className="text-zinc-500 text-xs uppercase tracking-wide mb-1">Rôle</dt>
                <dd className="text-white capitalize">{user.role}</dd>
              </div>
              {user.isPremium && user.premiumExpiresAt && (
                <div>
                  <dt className="text-zinc-500 text-xs uppercase tracking-wide mb-1">Premium jusqu&apos;au</dt>
                  <dd className="text-amber-300">
                    {new Date(user.premiumExpiresAt).toLocaleDateString('fr-FR')}
                  </dd>
                </div>
              )}
            </dl>
          </div>

          <div className="card">
            <h2 className="font-semibold text-white mb-4">Avis reçus</h2>
            {reviews.length === 0 ? (
              <p className="text-zinc-500 text-sm">Aucun avis pour le moment.</p>
            ) : (
              <ul className="space-y-4">
                {reviews.map((r) => (
                  <li key={r._id} className="text-sm border-b border-white/[0.06] pb-4 last:border-0 last:pb-0">
                    <p className={r.rating === 0 ? 'text-red-400' : 'text-amber-400 font-medium'}>
                      {r.rating === 0 ? '0/5' : `${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}`}
                    </p>
                    {r.comment && <p className="text-zinc-300 mt-1.5">{r.comment}</p>}
                    <p className="text-zinc-600 text-xs mt-2">
                      {r.from ? `${r.from.firstname} ${r.from.lastname}` : 'Utilisateur'} ·{' '}
                      {new Date(r.createdAt).toLocaleDateString('fr-FR')}
                      {r.autoPenalty && ' · Automatique'}
                    </p>
                    {!r.autoPenalty && (
                      <ReportReviewButton
                        reviewId={r._id}
                        onReported={() =>
                          reviewsApi.forUser(user.id).then((res) => setReviews(res.reviews))
                        }
                      />
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="card">
            <h2 className="font-semibold text-white mb-4">Annonces ouvertes</h2>
            {listings.length === 0 ? (
              <p className="text-zinc-500 text-sm">Aucune annonce active.</p>
            ) : (
              <ul className="divide-y divide-white/[0.06]">
                {listings.map((l) => (
                  <li key={l._id} className="flex justify-between items-center py-3 text-sm first:pt-0 last:pb-0">
                    <span className="text-zinc-200 truncate pr-4">{l.title}</span>
                    <span className="text-emerald-400 font-medium tabular-nums shrink-0">{l.price} M</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </AppShell>
    </>
  );
}
