'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import Navbar from '@/components/Navbar';
import AppShell from '@/components/AppShell';
import ProfileBadges from '@/components/ProfileBadges';
import PremiumBadge from '@/components/PremiumBadge';
import { profileApi } from '@/lib/api';
import { PublicUserProfile, Listing } from '@/lib/types';
import ReviewsSection from '@/components/reviews/ReviewsSection';
import StarRating from '@/components/reviews/StarRating';
import { useAuth } from '@/context/AuthContext';

export default function PublicProfilePage() {
  const { id } = useParams<{ id: string }>();
  const { user: me } = useAuth();
  const [profile, setProfile] = useState<PublicUserProfile | null>(null);
  const [listings, setListings] = useState<Partial<Listing>[]>([]);
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

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Réputation', value: profile.reputation },
              {
                label: 'Note',
                value: profile.reviewCount && profile.averageRating ? `${profile.averageRating.toFixed(1)}/5` : '—',
                stars: profile.reviewCount ? profile.averageRating : null,
              },
              { label: 'Avis', value: profile.reviewCount },
              { label: 'Échanges', value: profile.transactionCount },
            ].map((s) => (
              <div key={s.label} className="card py-4 text-center">
                <p className="text-2xl font-bold text-white tabular-nums">{s.value}</p>
                {s.stars != null && <StarRating value={s.stars} size="xs" className="mt-1" />}
                <p className="text-xs text-zinc-500 mt-1 uppercase tracking-wide">{s.label}</p>
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

          <ReviewsSection
            userId={profile.id}
            averageRating={profile.averageRating ?? 0}
            reviewCount={profile.reviewCount ?? 0}
            canReport={isMe}
          />
        </div>
      </AppShell>
    </>
  );
}
