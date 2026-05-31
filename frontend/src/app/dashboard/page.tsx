'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import AppShell from '@/components/AppShell';
import BalanceCard from '@/components/BalanceCard';
import TransactionList from '@/components/TransactionList';
import CompleteProfile from '@/components/CompleteProfile';
import { useAuth } from '@/context/AuthContext';
import MissionStepsBar from '@/components/MissionStepsBar';
import { adminApi, listingsApi, userApi } from '@/lib/api';
import { UserStats } from '@/lib/types';
import MissionChat from '@/components/MissionChat';
import UnreadBadge from '@/components/UnreadBadge';
import UsageLimitsCard from '@/components/UsageLimitsCard';
import PremiumBadge from '@/components/PremiumBadge';
import AdminBadge from '@/components/AdminBadge';
import MissionReviewForm from '@/components/MissionReviewForm';
import MissionDisputeForm from '@/components/MissionDisputeForm';
import MyListingRow from '@/components/MyListingRow';
import { Transaction, Listing, Mission } from '@/lib/types';

export default function DashboardPage() {
  const { user, loading, needsProfile, authError, refreshUser } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [chatMission, setChatMission] = useState<Mission | null>(null);
  const [announcement, setAnnouncement] = useState<{
    _id: string;
    title: string;
    message: string;
  } | null>(null);
  const [completedMissions, setCompletedMissions] = useState<Mission[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [listMsg, setListMsg] = useState('');
  const [disputeMissionId, setDisputeMissionId] = useState<string | null>(null);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [tab, setTab] = useState<'active' | 'todo' | 'archives'>('active');

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
      setListings((prev) => prev.filter((l) => l._id !== id));
      setListMsg('Annonce supprimée du site.');
      await loadDashboard();
      loadAnnouncement();
    } catch (err) {
      setListMsg(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setDeletingId(null);
    }
  }

  const loadAnnouncement = () => {
    fetch(`/api/announcements/active?_=${Date.now()}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => setAnnouncement(d.announcement || null))
      .catch(() => setAnnouncement(null));
  };

  useEffect(() => {
    loadAnnouncement();
    const t = setInterval(loadAnnouncement, 60000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!user) return;
    loadDashboard().catch(console.error);
    userApi.stats().then((s) => setStats(s.stats)).catch(() => {});
    const interval = setInterval(() => loadDashboard().catch(console.error), 15000);
    return () => clearInterval(interval);
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-milou-bg">
        <img src="/milou-logo.svg" alt="" width={32} height={32} className="animate-pulse" />
        <p className="text-zinc-500 text-sm">Chargement du tableau de bord…</p>
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
  const draftListings = listings.filter((l) => l.status === 'draft');
  const archivedListings = listings.filter((l) => ['expired', 'closed', 'completed'].includes(l.status));
  const todoListings = [...draftListings, ...listings.filter((l) => l.status === 'open')];

  return (
    <>
      <Navbar />
      <AppShell
        title={`Bonjour, ${user.firstname}`}
        subtitle="Votre espace MILOU — missions, annonces et Milou"
        headerRight={
          <div className="flex flex-wrap gap-2 items-center">
            {user.role === 'admin' && <AdminBadge />}
            {user.isPremium && <PremiumBadge />}
            {!user.isPremium && (
              <Link href="/premium" className="btn-secondary text-sm border-amber-500/30 text-amber-300">
                Premium
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
            <Link href="/marketplace" className="sidebar-link">
              <span className="w-5 h-5 rounded bg-indigo-500/20" />
              Explorer le marketplace
            </Link>
            <Link href="/create" className="sidebar-link">
              <span className="w-5 h-5 rounded bg-indigo-500/20" />
              Nouvelle annonce
            </Link>
            <div className="p-3 rounded-xl border border-white/[0.06] bg-milou-surface/50">
              <p className="text-zinc-500 text-xs font-medium uppercase tracking-wide">Annonces ouvertes</p>
              <p className="text-2xl font-bold text-white tabular-nums">{openListings}</p>
            </div>
            <div className="p-3 rounded-xl border border-white/[0.06] bg-milou-surface/50">
              <p className="text-zinc-500 text-xs font-medium uppercase tracking-wide">Missions actives</p>
              <p className="text-2xl font-bold text-white tabular-nums">{missions.length}</p>
            </div>
          </div>
        }
      >
        {announcement && (
          <div className="card border-indigo-500/20 bg-indigo-500/5 mb-6 relative">
            {(user.role === 'admin' || user.role === 'moderator') && (
              <button
                type="button"
                className="absolute top-3 right-3 text-xs text-red-400 hover:text-red-300"
                onClick={async () => {
                  if (!confirm('Supprimer ce bandeau pour tous les utilisateurs ?')) return;
                  try {
                    await adminApi.deleteAnnouncement(announcement._id);
                    setAnnouncement(null);
                  } catch (err) {
                    alert(err instanceof Error ? err.message : 'Erreur');
                  }
                }}
              >
                Supprimer le bandeau
              </button>
            )}
            <p className="font-semibold text-indigo-300">{announcement.title}</p>
            <p className="text-zinc-400 text-sm mt-1">{announcement.message}</p>
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2">
            <BalanceCard balance={user.balance} />
          </div>
          <UsageLimitsCard isPremium={user.isPremium} />
        </div>

        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
            {[
              { label: 'M ce mois (gagnés)', value: stats.milouEarnedThisMonth.toFixed(1) },
              { label: 'M ce mois (dépensés)', value: stats.milouSpentThisMonth.toFixed(1) },
              { label: 'Missions terminées', value: stats.completedMissions },
              { label: 'Annonces ouvertes', value: stats.openListings },
            ].map((s) => (
              <div key={s.label} className="card py-3 text-center">
                <p className="text-xl font-bold text-white tabular-nums">{s.value}</p>
                <p className="text-[10px] text-zinc-500 uppercase tracking-wide mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-2 mb-6">
          {(['active', 'todo', 'archives'] as const).map((t) => (
            <button
              key={t}
              type="button"
              className={tab === t ? 'chip-active px-4 py-2 rounded-xl text-sm' : 'chip px-4 py-2 rounded-xl text-sm'}
              onClick={() => setTab(t)}
            >
              {t === 'active' ? 'Missions' : t === 'todo' ? 'À faire' : 'Archives'}
            </button>
          ))}
          <Link href="/transactions" className="chip px-4 py-2 rounded-xl text-sm ml-auto">
            Historique complet →
          </Link>
        </div>

        {tab !== 'active' && (
          <section className="card mb-8">
            <h2 className="text-lg font-semibold text-white mb-4">
              {tab === 'todo' ? 'Brouillons et annonces' : 'Annonces archivées'}
            </h2>
            <ul className="space-y-2">
              {(tab === 'todo' ? todoListings : archivedListings).map((l) => (
                <MyListingRow
                  key={l._id}
                  listing={l}
                  onDelete={handleDeleteListing}
                  deleting={deletingId === l._id}
                />
              ))}
            </ul>
            {(tab === 'todo' ? todoListings : archivedListings).length === 0 && (
              <p className="text-zinc-500 text-sm">Rien ici pour le moment.</p>
            )}
          </section>
        )}

        {tab === 'active' && (
        <div className="grid lg:grid-cols-2 gap-6 mb-8">
          <section className="card">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-white">
              Missions en cours
              <UnreadBadge count={missions.reduce((sum, m) => sum + (m.unreadCount || 0), 0)} />
            </h2>
            {missions.length === 0 ? (
              <p className="text-gray-500 text-sm">
                Aucune mission active.{' '}
                <Link href="/marketplace" className="text-indigo-400 hover:text-indigo-300">
                  Parcourir le marketplace
                </Link>
              </p>
            ) : (
              <ul className="space-y-3">
                {missions.map((m) => {
                  const overdue = m.dueAt && new Date(m.dueAt).getTime() < Date.now();
                  const isProvider =
                    m.providerUid === user.id ||
                    m.providerId === user.id ||
                    m.providerId?.email === user.email;
                  const isClient =
                    m.clientUid === user.id ||
                    m.clientId === user.id ||
                    m.clientId?.email === user.email;
                  const isDisputed = m.status === 'disputed';
                  return (
                  <li
                    key={m._id}
                    className={`p-3 rounded-xl bg-milou-surface/60 border ${
                      overdue ? 'border-red-500/30' : 'border-white/[0.06]'
                    }`}
                  >
                    <p className="font-medium">{m.listingId?.title || 'Mission'}</p>
                    <p className="text-sm text-gray-400">
                      {m.amount} M · {getOtherPartyName(m)}
                      {isDisputed && (
                        <span className="ml-2 text-amber-400">· En attente admin</span>
                      )}
                    </p>
                    {isDisputed && m.disputeReason && (
                      <p className="text-xs text-amber-300/90 mt-1 line-clamp-2">
                        Motif : {m.disputeReason}
                      </p>
                    )}
                    {m.dueAt && (
                      <p className={`text-xs mt-1 ${overdue ? 'text-red-400' : 'text-gray-500'}`}>
                        {overdue ? '⚠ Délai dépassé — ' : 'Date limite : '}
                        {new Date(m.dueAt).toLocaleString('fr-FR')}
                        {isProvider && !overdue && ' · À terminer avant cette date'}
                        {m.clientId?.email === user.email &&
                          ' · Validez quand le travail est terminé'}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-2 mt-2">
                      <button
                        type="button"
                        className="btn-secondary text-xs py-1.5 inline-flex items-center gap-2"
                        onClick={() => setChatMission(m)}
                      >
                        Chat
                        <UnreadBadge count={m.unreadCount || 0} />
                      </button>
                      {isClient && !isDisputed && disputeMissionId !== m._id && (
                        <>
                          <button
                            type="button"
                            className="btn-primary text-xs py-1.5"
                            onClick={async () => {
                              if (!confirm('Valider la mission et libérer le paiement au prestataire ?')) return;
                              await listingsApi.completeMission(m._id);
                              setChatMission(null);
                              setDisputeMissionId(null);
                              await refreshUser();
                              await loadDashboard();
                            }}
                          >
                            Valider
                          </button>
                          <button
                            type="button"
                            className="btn-secondary text-xs py-1.5 border-amber-500/40 text-amber-200"
                            onClick={() => setDisputeMissionId(m._id)}
                          >
                            Ne pas valider
                          </button>
                        </>
                      )}
                    </div>
                    {isClient && disputeMissionId === m._id && !isDisputed && (
                      <MissionDisputeForm
                        missionId={m._id}
                        onCancel={() => setDisputeMissionId(null)}
                        onDone={async () => {
                          setDisputeMissionId(null);
                          setChatMission(null);
                          await loadDashboard();
                        }}
                      />
                    )}
                    <MissionStepsBar
                      missionId={m._id}
                      steps={m.steps}
                      isClient={!!isClient}
                      isProvider={!!isProvider}
                      onUpdate={() => loadDashboard()}
                    />
                  </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="card">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-white">Mes annonces</h2>
              <Link href="/create" className="text-indigo-400 text-sm hover:text-indigo-300">
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
        )}

        {tab === 'active' && completedMissions.length > 0 && (
          <section className="card mb-8">
            <h2 className="text-lg font-semibold mb-4 text-white">Missions terminées — avis</h2>
            <ul className="space-y-4">
              {completedMissions.slice(0, 3).map((m) => (
                <li key={m._id} className="p-3 rounded-xl bg-milou-surface/60 border border-white/[0.06]">
                  <p className="font-medium text-sm">{m.listingId?.title || 'Mission'}</p>
                  {m.completedReason === 'deadline_missed' && (
                    <p className="text-xs text-red-400 mt-1">
                      Clôturée automatiquement — délai non respecté
                    </p>
                  )}
                  {m.completedReason !== 'deadline_missed' && (
                    <MissionReviewForm missionId={m._id} onDone={() => loadDashboard()} />
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {tab === 'active' && (
        <section className="card">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-white">Dernières transactions</h2>
            <Link href="/transactions" className="text-sm text-indigo-400">Tout voir</Link>
          </div>
          <TransactionList transactions={transactions.slice(0, 8)} />
        </section>
        )}
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
