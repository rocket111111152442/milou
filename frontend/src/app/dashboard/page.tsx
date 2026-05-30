'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import BalanceCard from '@/components/BalanceCard';
import TransactionList from '@/components/TransactionList';
import CompleteProfile from '@/components/CompleteProfile';
import { useAuth } from '@/context/AuthContext';
import { listingsApi, userApi } from '@/lib/api';
import MissionChat from '@/components/MissionChat';
import UnreadBadge from '@/components/UnreadBadge';
import { Transaction, Listing, Mission } from '@/lib/types';

export default function DashboardPage() {
  const { user, loading, needsProfile, authError, refreshUser } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [chatMission, setChatMission] = useState<Mission | null>(null);

  function getOtherPartyName(m: Mission): string {
    const isClient = m.clientUid === user?.id || m.clientId?.email === user?.email;
    const other = isClient ? m.providerId : m.clientId;
    return other ? `${other.firstname} ${other.lastname}`.trim() : 'Partenaire';
  }

  const loadDashboard = () => {
    if (!user) return Promise.resolve();
    return userApi.dashboard().then(({ transactions: tx, listings: ls, missions: ms }) => {
      setTransactions(tx as Transaction[]);
      setListings((ls as Listing[]).slice(0, 5));
      setMissions(ms as Mission[]);
    });
  };

  useEffect(() => {
    if (!user) return;
    loadDashboard().catch(console.error);
    const interval = setInterval(() => loadDashboard().catch(console.error), 15000);
    return () => clearInterval(interval);
  }, [user]);

  if (loading) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center gap-3"
        style={{ background: '#0a0e17' }}
      >
        <p className="text-cyan-400 text-lg animate-pulse">Chargement du tableau de bord…</p>
      </div>
    );
  }

  if (needsProfile || (!user && !authError)) {
    return <CompleteProfile />;
  }

  if (authError && !user) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: '#0a0e17' }}>
        <div className="card max-w-md">
          <p className="text-milou-danger mb-4">{authError}</p>
          <p className="text-gray-400 text-sm mb-4">
            Vérifiez <code className="text-cyan-400">frontend/.env.local</code> et redémarrez{' '}
            <code className="text-cyan-400">npm run dev</code>.
          </p>
          <Link href="/login" className="btn-primary inline-block">
            Retour connexion
          </Link>
        </div>
      </div>
    );
  }

  if (!user) {
    return <CompleteProfile />;
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
            <Link href="/transfer" className="btn-primary text-sm">
              Envoyer des Milou
            </Link>
            <Link href="/create" className="btn-secondary text-sm">
              Nouvelle annonce
            </Link>
          </div>
        </div>

        <BalanceCard balance={user.balance} />

        <div className="grid lg:grid-cols-2 gap-6">
          <section className="card">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              Missions en cours
              <UnreadBadge
                count={missions.reduce((sum, m) => sum + (m.unreadCount || 0), 0)}
              />
            </h2>
            {missions.length === 0 ? (
              <p className="text-gray-500 text-sm">Aucune mission active.</p>
            ) : (
              <ul className="space-y-3">
                {missions.map((m) => (
                  <li key={m._id} className="p-3 rounded-lg bg-milou-bg border border-milou-border">
                    <p className="font-medium">{m.listingId?.title || 'Mission'}</p>
                    <p className="text-sm text-gray-400">
                      {m.amount} M · En cours · {getOtherPartyName(m)}
                    </p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <button
                        type="button"
                        className="btn-secondary text-xs py-1.5 inline-flex items-center gap-2"
                        onClick={() => setChatMission(m)}
                      >
                        Ouvrir le chat
                        <UnreadBadge count={m.unreadCount || 0} />
                      </button>
                      {m.clientId?.email === user.email && (
                        <button
                          type="button"
                          className="btn-primary text-xs py-1.5"
                          onClick={async () => {
                            await listingsApi.completeMission(m._id);
                            setChatMission(null);
                            await refreshUser();
                            await loadDashboard();
                          }}
                        >
                          Valider la mission
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Mes annonces</h2>
              <Link href="/create" className="text-cyan-400 text-sm">
                + Créer
              </Link>
            </div>
            {listings.length === 0 ? (
              <p className="text-gray-500 text-sm">Aucune annonce — créez-en une pour le marketplace.</p>
            ) : (
              <ul className="space-y-2">
                {listings.map((l) => (
                  <li key={l._id} className="flex justify-between text-sm p-2 rounded bg-milou-bg">
                    <span>{l.title}</span>
                    <span className="text-cyan-400">
                      {l.price} M · {l.status}
                    </span>
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

      {chatMission && user && (
        <MissionChat
          missionId={chatMission._id}
          missionTitle={chatMission.listingId?.title || 'Mission'}
          currentUserId={user.id}
          otherPartyName={getOtherPartyName(chatMission)}
          open={!!chatMission}
          onClose={() => {
            setChatMission(null);
            loadDashboard().catch(console.error);
          }}
          onMarkedRead={() => loadDashboard().catch(console.error)}
        />
      )}
    </>
  );
}
