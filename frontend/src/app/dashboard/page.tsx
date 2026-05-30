'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import AppShell from '@/components/AppShell';
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
import MyListingRow from '@/components/MyListingRow';
import { Transaction, Listing, Mission } from '@/lib/types';

export default function DashboardPage() {
  const { user, loading, needsProfile, authError, refreshUser } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [chatMission, setChatMission] = useState<Mission | null>(null);
  const [announcement, setAnnouncement] = useState<{ title: string; message: string } | null>(null);
  const [completedMissions, setCompletedMissions] = useState<Mission[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [listMsg, setListMsg] = useState('');

  function getOtherPartyName(m: Mission): string {
    const isClient = m.clientUid === user?.id || m.clientId?.email === user?.email;
    const other = isClient ? m.providerId : m.clientId;
    return other ? `${other.firstname} ${other.lastname}`.trim() : 'Partenaire';
  }

  const loadDashboard = () => {
    if (!user) return Promise.resolve();
    return userApi.dashboard().then((d) => {
      setTransactions(d.transactions as Transaction[]);
      setListings(d.listings as Listing[]);
      setMissions(d.missions as Mission[]);
      setCompletedMissions((d.completedMissions as Mission[]) || []);
    });
  };

  async function handleDeleteListing(id: string) {
    setListMsg('');
    setDeletingId(id);
    try {
      await listingsApi.delete(id);
      setListMsg('Annonce supprimée.');
      await loadDashboard();
    } catch (err) {
      setListMsg(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setDeletingId(null);
    }
  }

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
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-milou-bg">
        <p className="text-cyan-400 text-lg animate-pulse">Chargement du tableau de bord…</p>
      </div>
    );
  }

  if (needsProfile || (!user && !authError)) {
    return <CompleteProfile />;
  }

  if (authError && !user) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-milou-bg">
        <div className="card max-w-md">
          <p className="text-milou-danger mb-4">{authError}</p>
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

  const openListings = listings.filter((l) => l.status === 'open').length;

  return (
    <>
      <Navbar />
      <AppShell
        title={`Bonjour, ${user.firstname}`}
        subtitle="Votre espace MILOU — missions, annonces et Milou"
        headerRight={
          <div className="flex flex-wrap gap-2 items-center">
            {user.isPremium && <PremiumBadge />}
            {!user.isPremium && (
              <Link href="/premium" className="btn-secondary text-sm border-amber-500/40 text-amber-300">
                ⭐ Premium
              </Link>
            )}
            <Link href="/transfer" className="btn-primary text-sm">
              Envoyer des M
            </Link>
            <Link href="/create" className="btn-secondary text-sm">
              + Annonce
            </Link>
          </div>
        }
        sidebarExtra={
          <div className="space-y-3 text-sm">
            <p className="sidebar-section-title">Raccourcis</p>
            <Link href="/marketplace" className="sidebar-link bg-gradient-to-r from-violet-500/15 to-transparent">
              <span>🛒</span> Explorer le marketplace
            </Link>
            <Link href="/create" className="sidebar-link bg-gradient-to-r from-pink-500/15 to-transparent">
              <span>✨</span> Nouvelle annonce
            </Link>
            <div className="p-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5">
              <p className="text-emerald-400 text-xs font-semibold">Annonces ouvertes</p>
              <p className="text-2xl font-bold text-white">{openListings}</p>
            </div>
            <div className="p-3 rounded-xl border border-amber-500/20 bg-amber-500/5">
              <p className="text-amber-400 text-xs font-semibold">Missions actives</p>
              <p className="text-2xl font-bold text-white">{missions.length}</p>
            </div>
          </div>
        }
      >
        {announcement && (
          <div className="card border-violet-500/40 bg-gradient-to-r from-violet-500/15 to-pink-500/10 mb-6">
            <p className="font-semibold text-violet-300">📢 {announcement.title}</p>
            <p className="text-gray-300 text-sm mt-1">{announcement.message}</p>
          </div>
        )}

        <div className="hero-glow mb-8" />

        <div className="grid lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2">
            <BalanceCard balance={user.balance} />
          </div>
          <UsageLimitsCard isPremium={user.isPremium} />
        </div>

        <div className="grid lg:grid-cols-2 gap-6 mb-8">
          <section className="card border-cyan-500/20 bg-gradient-to-br from-milou-card to-cyan-950/20">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-cyan-300">
              Missions en cours
              <UnreadBadge count={missions.reduce((sum, m) => sum + (m.unreadCount || 0), 0)} />
            </h2>
            {missions.length === 0 ? (
              <p className="text-gray-500 text-sm">
                Aucune mission active.{' '}
                <Link href="/marketplace" className="text-cyan-400 hover:underline">
                  Parcourir le marketplace
                </Link>
              </p>
            ) : (
              <ul className="space-y-3">
                {missions.map((m) => (
                  <li key={m._id} className="p-3 rounded-xl bg-milou-bg/80 border border-cyan-500/20">
                    <p className="font-medium">{m.listingId?.title || 'Mission'}</p>
                    <p className="text-sm text-gray-400">
                      {m.amount} M · {getOtherPartyName(m)}
                    </p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <button
                        type="button"
                        className="btn-secondary text-xs py-1.5 inline-flex items-center gap-2"
                        onClick={() => setChatMission(m)}
                      >
                        💬 Chat
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
                          Valider ✓
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card border-pink-500/20 bg-gradient-to-br from-milou-card to-pink-950/15">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-pink-200">Mes annonces</h2>
              <Link href="/create" className="text-cyan-400 text-sm hover:underline">
                + Créer
              </Link>
            </div>
            {listMsg && <p className="alert-success text-xs mb-3 py-2">{listMsg}</p>}
            {listings.length === 0 ? (
              <p className="text-gray-500 text-sm">Aucune annonce — publiez sur le marketplace.</p>
            ) : (
              <ul className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {listings.map((l) => (
                  <MyListingRow
                    key={l._id}
                    listing={l}
                    onDelete={handleDeleteListing}
                    deleting={deletingId === l._id}
                  />
                ))}
              </ul>
            )}
            <p className="text-xs text-gray-600 mt-3">
              Suppression possible si l&apos;annonce est disponible ou terminée (pas en mission).
            </p>
          </section>
        </div>

        {completedMissions.length > 0 && (
          <section className="card border-violet-500/20 mb-8">
            <h2 className="text-lg font-semibold mb-4 text-violet-300">Missions terminées — avis</h2>
            <ul className="space-y-4">
              {completedMissions.slice(0, 3).map((m) => (
                <li key={m._id} className="p-3 rounded-xl bg-milou-bg border border-violet-500/20">
                  <p className="font-medium text-sm">{m.listingId?.title || 'Mission'}</p>
                  {m.clientId?.email === user.email && (
                    <MissionReviewForm missionId={m._id} onDone={() => loadDashboard()} />
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="card border-milou-border">
          <h2 className="text-lg font-semibold mb-4">Historique des transactions</h2>
          <TransactionList transactions={transactions} />
        </section>
      </AppShell>

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
