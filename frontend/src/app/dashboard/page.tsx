'use client';

import { useEffect, useState } from 'react';
import Navbar from '@/components/Navbar';
import BalanceCard from '@/components/BalanceCard';
import TransactionList from '@/components/TransactionList';
import { useAuth } from '@/context/AuthContext';
import { listingsApi } from '@/lib/api';
import { fetchMyListings, fetchMyTransactions, fetchMyMissions } from '@/lib/firestore-client';
import { Transaction, Listing, Mission } from '@/lib/types';
import Link from 'next/link';

export default function DashboardPage() {
  const { user, loading, refreshUser } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [missions, setMissions] = useState<Mission[]>([]);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      fetchMyTransactions(user.id),
      fetchMyListings(user.id),
      fetchMyMissions(user.id),
    ]).then(([tx, ls, ms]) => {
      setTransactions(tx);
      setListings(ls.slice(0, 5));
      setMissions(ms);
    });
  }, [user]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-cyan-400 animate-pulse">Chargement...</div>
      </div>
    );
  }

  return (
    <>
      <Navbar />
      <main className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Bonjour, {user.firstname}</h1>
            <p className="text-gray-400">Votre tableau de bord MILOU</p>
          </div>
          <div className="flex gap-2">
            <Link href="/transfer" className="btn-primary text-sm">Envoyer des Milou</Link>
            <Link href="/create" className="btn-secondary text-sm">Nouvelle annonce</Link>
          </div>
        </div>

        <BalanceCard balance={user.balance} />

        <div className="grid lg:grid-cols-2 gap-6">
          <section className="card">
            <h2 className="text-lg font-semibold mb-4">Missions en cours</h2>
            {missions.length === 0 ? (
              <p className="text-gray-500 text-sm">Aucune mission active.</p>
            ) : (
              <ul className="space-y-3">
                {missions.map((m) => (
                  <li key={m._id} className="p-3 rounded-lg bg-milou-bg border border-milou-border">
                    <p className="font-medium">{m.listingId?.title || 'Mission'}</p>
                    <p className="text-sm text-gray-400">{m.amount} M · En cours</p>
                    {m.clientId?.email === user.email && (
                      <button
                        className="btn-primary text-xs mt-2"
                        onClick={async () => {
                          await listingsApi.completeMission(m._id);
                          await refreshUser();
                          setMissions(await fetchMyMissions(user.id));
                        }}
                      >
                        Valider la mission
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Mes annonces</h2>
              <Link href="/create" className="text-cyan-400 text-sm">+ Créer</Link>
            </div>
            {listings.length === 0 ? (
              <p className="text-gray-500 text-sm">Aucune annonce.</p>
            ) : (
              <ul className="space-y-2">
                {listings.map((l) => (
                  <li key={l._id} className="flex justify-between text-sm p-2 rounded bg-milou-bg">
                    <span>{l.title}</span>
                    <span className="text-cyan-400">{l.price} M · {l.status}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <section className="card">
          <h2 className="text-lg font-semibold mb-4">Historique des transactions</h2>
          <TransactionList transactions={transactions} />
        </section>
      </main>
    </>
  );
}
