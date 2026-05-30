'use client';

import { useEffect, useState } from 'react';
import Navbar from '@/components/Navbar';
import BalanceCard from '@/components/BalanceCard';
import { useAuth } from '@/context/AuthContext';
import { userApi } from '@/lib/api';
import { Listing } from '@/lib/types';

export default function ProfilePage() {
  const { user, loading } = useAuth();
  const [listings, setListings] = useState<Listing[]>([]);

  useEffect(() => {
    if (!user) return;
    userApi.dashboard().then((d) =>
      setListings((d.listings as Listing[]).filter((l) => l.status === 'open'))
    );
  }, [user]);

  if (loading || !user) {
    return <div className="min-h-screen flex items-center justify-center text-cyan-400">Chargement...</div>;
  }

  return (
    <>
      <Navbar />
      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <h1 className="text-2xl font-bold">Mon profil</h1>
        <BalanceCard balance={user.balance} />

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Réputation', value: user.reputation, icon: '★' },
            { label: 'Total gagné', value: `${user.totalEarned.toFixed(0)} M`, icon: '↑' },
            { label: 'Total dépensé', value: `${user.totalSpent.toFixed(0)} M`, icon: '↓' },
            { label: 'Transactions', value: user.transactionCount, icon: '#' },
          ].map((s) => (
            <div key={s.label} className="card text-center">
              <p className="text-2xl text-cyan-400">{s.icon} {s.value}</p>
              <p className="text-gray-400 text-sm mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        <div className="card">
          <h2 className="font-semibold mb-4">Informations</h2>
          <dl className="grid sm:grid-cols-2 gap-3 text-sm">
            <div><dt className="text-gray-500">Nom</dt><dd>{user.firstname} {user.lastname}</dd></div>
            <div><dt className="text-gray-500">Email</dt><dd>{user.email}</dd></div>
            <div><dt className="text-gray-500">Rôle</dt><dd className="capitalize">{user.role}</dd></div>
            <div><dt className="text-gray-500">Membre depuis</dt><dd>{new Date(user.createdAt).toLocaleDateString('fr-FR')}</dd></div>
          </dl>
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
