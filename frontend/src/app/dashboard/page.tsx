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
import UsageLimitsCard from '@/components/UsageLimitsCard';
import PremiumBadge from '@/components/PremiumBadge';
import MissionReviewForm from '@/components/MissionReviewForm';
import { Transaction, Listing, Mission } from '@/lib/types';

export default function DashboardPage() {
  const { user, loading, needsProfile, authError, refreshUser } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [chatMission, setChatMission] = useState<Mission | null>(null);
  const [announcement, setAnnouncement] = useState<{ title: string; message: string } | null>(null);
  const [completedMissions, setCompletedMissions] = useState<Mission[]>([]);

  function getOtherPartyName(m: Mission): string {
    const isClient = m.clientUid === user?.id || m.clientId?.email === user?.email;
    const other = isClient ? m.providerId : m.clientId;
    return other ? `${other.firstname} ${other.lastname}`.trim() : 'Partenaire';
  }

  const loadDashboard = () => {
    if (!user) return Promise.resolve();
    return userApi.dashboard().then((d) => {
      setTransactions(d.transactions as Transaction[]);
      setListings((d.listings as Listing[]).slice(0, 5));
      setMissions(d.missions as Mission[]);
      setCompletedMissions((d.completedMissions as Mission[]) || []);
    });
  };

  useEffect(() => {
    fetch('/api/announcements/active')
      .then((r) => r.json())
      .then((d) => setAnnouncement(d.announcement))
      .catch(() => {});
  }, []);

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
        {announcement && (
          <div className="card border-violet-500/40 bg-violet-500/10">
            <p className="font-semibold text-violet-300">{announcement.title}</p>
            <p className="text-gray-300 text-sm mt-1">{announcement.message}</p>
          </div>
        )}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex flex-wrap items-center gap-2">
              Bonjour, {user.firstname}
              {user.isPremium && <PremiumBadge />}
            </h1>
            <p className="text-gray-400">Votre tableau de bord MILOU</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {!user.isPremium && (
              <Link
                href="/premium"
                className="text-sm px-4 py-2 rounded-lg bg-gradient-to-r from-amber-500/20 to-yellow-500/20 text-amber-300 border border-amber-500/30 hover:border-amber-400/50 transition"
              >
                ⭐ Devenir Premium
              </Link>
            )}
            <Link href="/transfer" className="btn-primary text-sm">
              Envoyer des Milou
            </Link>
            <Link href="/create" className="btn-secondary text-sm">
              Nouvelle annonce
            </Link>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <BalanceCard balance={user.balance} />
          </div>
          <UsageLimitsCard isPremium={user.isPremium} />
        </div>

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

        {completedMissions.length > 0 && (
          <section className="card">
            <h2 className="text-lg font-semibold mb-4">Missions terminées — laisser un avis</h2>
            <ul className="space-y-4">
              {completedMissions.slice(0, 3).map((m) => (
                <li key={m._id} className="p-3 rounded-lg bg-milou-bg border border-milou-border">
                  <p className="font-medium text-sm">{m.listingId?.title || 'Mission'}</p>
                  {m.clientId?.email === user.email && (
                    <MissionReviewForm missionId={m._id} onDone={() => loadDashboard()} />
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

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
