'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import Navbar from '@/components/Navbar';
import AppShell from '@/components/AppShell';
import ProfileBadges from '@/components/ProfileBadges';
import PremiumBadge from '@/components/PremiumBadge';
import { profileApi, reviewsApi } from '@/lib/api';
import { PublicUserProfile, Review, Listing } from '@/lib/types';
import { useAuth } from '@/context/AuthContext';

export default function PublicProfilePage() {
  const { id } = useParams<{ id: string }>();
  const { user: me } = useAuth();
  const [profile, setProfile] = useState<PublicUserProfile | null>(null);
  const [listings, setListings] = useState<Partial<Listing>[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    profileApi
      .public(id)
      .then((d) => {
        setProfile(d.user);
        setListings(d.listings);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Erreur'));
    reviewsApi.forUser(id).then((r) => setReviews(r.reviews)).catch(() => {});
  }, [id]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-milou-bg">
        <p className="text-red-400">{error}</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-milou-bg">
        <p className="text-zinc-500">Chargement…</p>
      </div>
    );
  }

  const isMe = me?.id === profile.id;

  return (
    <>
      <Navbar />
      <AppShell
        title={`${profile.firstname} ${profile.lastname}`}
        subtitle={
          profile.postalCode
            ? `Code postal ${profile.postalCode} · Fiabilité ${profile.reliabilityScore}/100`
            : `Fiabilité ${profile.reliabilityScore}/100`
        }
        headerRight={profile.isPremium ? <PremiumBadge size="md" /> : undefined}
      >
        <div className="space-y-6 animate-fade-up">
          {isMe && (
            <Link href="/profile" className="text-sm text-indigo-400 hover:text-indigo-300">
              Modifier mon profil →
            </Link>
          )}

          <ProfileBadges badges={profile.badges} />

          {profile.bio && <p className="text-zinc-300">{profile.bio}</p>}

          {profile.skills && profile.skills.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {profile.skills.map((s) => (
                <span key={s} className="tag-chip">
                  {s}
                </span>
              ))}
            </div>
          )}

          <div className="grid sm:grid-cols-4 gap-4">
            {[
              { label: 'Réputation', value: profile.reputation },
              { label: 'Note', value: profile.averageRating ? `${profile.averageRating}/5` : '—' },
              { label: 'Avis', value: profile.reviewCount },
              { label: 'Échanges', value: profile.transactionCount },
            ].map((s) => (
              <div key={s.label} className="card py-4 text-center">
                <p className="text-2xl font-bold text-white">{s.value}</p>
                <p className="text-xs text-zinc-500 mt-1">{s.label}</p>
              </div>
            ))}
          </div>

          {listings.length > 0 && (
            <section className="card">
              <h2 className="text-lg font-semibold text-white mb-4">Annonces ouvertes</h2>
              <ul className="space-y-2">
                {listings.map((l) => (
                  <li key={l._id} className="flex justify-between items-center text-sm">
                    <span className="text-zinc-300">{l.title}</span>
                    <span className="text-emerald-400 font-medium">{l.price} M</span>
                  </li>
                ))}
              </ul>
              <Link href="/marketplace" className="text-sm text-indigo-400 mt-3 inline-block">
                Voir le marketplace
              </Link>
            </section>
          )}

          <section className="card">
            <h2 className="text-lg font-semibold text-white mb-4">Avis reçus</h2>
            {reviews.length === 0 ? (
              <p className="text-zinc-500 text-sm">Aucun avis pour le moment.</p>
            ) : (
              <ul className="space-y-3">
                {reviews.map((r) => (
                  <li key={r._id} className="p-3 rounded-xl bg-milou-surface/60 border border-white/[0.06]">
                    <p className="text-amber-400 text-sm">{'★'.repeat(r.rating)}</p>
                    {r.comment && <p className="text-zinc-400 text-sm mt-1">{r.comment}</p>}
                    <p className="text-xs text-zinc-600 mt-1">
                      {new Date(r.createdAt).toLocaleDateString('fr-FR')}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </AppShell>
    </>
  );
}
