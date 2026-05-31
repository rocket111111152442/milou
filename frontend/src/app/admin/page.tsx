'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import ChatMessageContent from '@/components/ChatMessageContent';
import AdminUserInspector from '@/components/admin/AdminUserInspector';
import TransactionList from '@/components/TransactionList';
import { useAuth } from '@/context/AuthContext';
import { adminApi, chatApi } from '@/lib/api';
import type {
  AdminAuditEntry,
  AdminStats,
  Listing,
  Mission,
  MissionMessage,
  PlatformAnnouncement,
  PromoCode,
  ReviewReport,
  Transaction,
  User,
} from '@/lib/types';

const MOD_FEATURES = [
  'Tableau de bord statistiques',
  'Examen détaillé de compte',
  'Recherche & filtres utilisateurs',
  'Gestion rôles (user / modérateur / admin)',
  'Suspension & bannissement',
  'Notes internes modérateur',
  'Ajustement solde Milou',
  'Modification réputation',
  'Réinitialisation mot de passe',
  'Historique transactions global',
  'Filtre transactions suspectes',
  'Modération statut annonces',
  'Suppression annonces',
  'Vue missions plateforme',
  'Lecture chats mission',
  'Annulation mission (admin)',
  'Journal d\'audit',
  'Export CSV utilisateurs',
  'Offrir Premium gratuit à un utilisateur',
  'Annonces plateforme (suppression)',
  'Codes promo & récompenses',
  'Signalements d\'avis & suppression',
];

type Tab =
  | 'dashboard'
  | 'inspector'
  | 'users'
  | 'transactions'
  | 'listings'
  | 'missions'
  | 'audit'
  | 'announcements'
  | 'codes'
  | 'review-reports';

const REPORT_REASON_LABELS: Record<string, string> = {
  injuste: 'Avis injuste ou faux',
  harcelement: 'Insulte / harcèlement',
  hors_sujet: 'Pas lié à la mission',
  erreur: 'Erreur',
  autre: 'Autre',
};

function isStaff(role?: string) {
  return role === 'admin' || role === 'moderator';
}

export default function AdminPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('dashboard');
  const [msg, setMsg] = useState('');

  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [audit, setAudit] = useState<AdminAuditEntry[]>([]);
  const [announcements, setAnnouncements] = useState<PlatformAnnouncement[]>([]);
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [reviewReports, setReviewReports] = useState<ReviewReport[]>([]);
  const [codeForm, setCodeForm] = useState({
    code: '',
    label: '',
    milouAmount: 50,
    premiumDays: 0,
    reputationBonus: 0,
    maxUses: 100,
    maxUsesPerUser: 1,
    minAccountAgeDays: 0,
    expiresAt: '',
    active: true,
  });

  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [searchQ, setSearchQ] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [txType, setTxType] = useState('');
  const [txMin, setTxMin] = useState('');
  const [chatMissionId, setChatMissionId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<MissionMessage[]>([]);
  const [annTitle, setAnnTitle] = useState('');
  const [annMessage, setAnnMessage] = useState('');

  const refreshUsers = useCallback(async () => {
    const r = await adminApi.users({
      q: searchQ || undefined,
      role: filterRole || undefined,
      status: filterStatus || undefined,
    });
    setUsers(r.users);
  }, [searchQ, filterRole, filterStatus]);

  const loadAll = useCallback(async () => {
    const [s, u, t, l, m, a, an, pc] = await Promise.all([
      adminApi.stats(),
      adminApi.users(),
      adminApi.transactions(),
      adminApi.listings(),
      adminApi.missions(),
      adminApi.audit(),
      adminApi.announcements(),
      adminApi.promoCodes(),
    ]);
    setStats(s.stats);
    setUsers(u.users);
    setTransactions(t.transactions);
    setListings(l.listings);
    setMissions(m.missions);
    setAudit(a.entries);
    setAnnouncements(an.announcements);
    setPromoCodes(pc.codes);
  }, []);

  useEffect(() => {
    if (!loading && user && !isStaff(user.role)) router.push('/dashboard');
  }, [user, loading, router]);

  useEffect(() => {
    if (!isStaff(user?.role)) return;
    loadAll().catch((e) => setMsg(e instanceof Error ? e.message : 'Erreur'));
  }, [user, loadAll]);

  useEffect(() => {
    if (tab !== 'review-reports' || !isStaff(user?.role)) return;
    adminApi
      .reviewReports('pending')
      .then((r) => setReviewReports(r.reports))
      .catch((e) => setMsg(e instanceof Error ? e.message : 'Erreur'));
  }, [tab, user]);

  useEffect(() => {
    if (tab === 'users' && isStaff(user?.role)) {
      refreshUsers().catch(() => {});
    }
  }, [tab, refreshUsers, user?.role]);

  async function loadTransactions() {
    const r = await adminApi.transactions({
      type: txType || undefined,
      minAmount: txMin ? Number(txMin) : undefined,
    });
    setTransactions(r.transactions);
  }

  async function openMissionChat(id: string) {
    setChatMissionId(id);
    const r = await adminApi.missionMessages(id);
    setChatMessages(r.messages);
  }

  async function exportCsv() {
    const blob = await adminApi.exportUsersCsv();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'milou-users.csv';
    a.click();
    URL.revokeObjectURL(url);
    setMsg('Export CSV téléchargé');
  }

  if (loading || !user || !isStaff(user.role)) {
    return <div className="min-h-screen flex items-center justify-center text-cyan-400">Chargement…</div>;
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'dashboard', label: 'Statistiques' },
    { id: 'inspector', label: 'Examen compte' },
    { id: 'users', label: 'Utilisateurs' },
    { id: 'transactions', label: 'Transactions' },
    { id: 'listings', label: 'Annonces' },
    { id: 'missions', label: 'Missions' },
    { id: 'audit', label: 'Journal' },
    { id: 'announcements', label: 'Annonces site' },
    { id: 'codes', label: 'Codes promo' },
    { id: 'review-reports', label: 'Avis signalés' },
  ];

  return (
    <>
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 py-8 animate-fade-up">
        <div className="mb-8">
          <p className="section-label">Administration</p>
          <h1 className="page-title mt-1">Panel modération</h1>
          <p className="page-subtitle">
            {MOD_FEATURES.length} outils — comptes, économie, annonces et missions
          </p>
        </div>
        <details className="mb-4 text-xs text-zinc-500">
          <summary className="cursor-pointer text-indigo-400/80">Liste des fonctionnalités</summary>
          <ol className="mt-2 grid sm:grid-cols-2 gap-1 list-decimal list-inside">
            {MOD_FEATURES.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ol>
        </details>

        {msg && (
          <p className="mb-4 text-sm text-indigo-300 alert-info">
            {msg}
          </p>
        )}

        <div className="flex flex-wrap gap-2 mb-6">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={tab === t.id ? 'admin-tab admin-tab-active' : 'admin-tab admin-tab-inactive'}
            >
              {t.label}
            </button>
          ))}
          <button type="button" className="btn-secondary text-sm ml-auto" onClick={exportCsv}>
            Export CSV
          </button>
        </div>

        {tab === 'dashboard' && stats && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Utilisateurs', value: stats.totalUsers },
                { label: 'Actifs', value: stats.activeUsers },
                { label: 'Suspendus', value: stats.suspendedUsers },
                { label: 'Bannis', value: stats.bannedUsers },
                { label: 'Milou en circulation', value: `${stats.totalMilouInCirculation.toFixed(0)} M` },
                { label: 'Annonces ouvertes', value: `${stats.openListings}/${stats.totalListings}` },
                { label: 'Missions actives', value: `${stats.activeMissions}/${stats.totalMissions}` },
                { label: 'Inscriptions 7j', value: stats.registrationsLast7Days },
              ].map((x) => (
                <div key={x.label} className="card py-4 text-center">
                  <p className="text-2xl font-bold text-cyan-400">{x.value}</p>
                  <p className="text-xs text-gray-500 mt-1">{x.label}</p>
                </div>
              ))}
            </div>
            <div className="card">
              <h3 className="font-semibold mb-3">Top soldes</h3>
              <ul className="space-y-2 text-sm">
                {stats.topBalances.map((t) => (
                  <li key={t.id} className="flex justify-between">
                    <button
                      type="button"
                      className="text-cyan-400 hover:underline text-left"
                      onClick={() => {
                        setSelectedUserId(t.id);
                        setTab('inspector');
                      }}
                    >
                      {t.name} ({t.email})
                    </button>
                    <span className="text-cyan-400">{t.balance.toFixed(2)} M</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {tab === 'inspector' && (
          <AdminUserInspector
            userId={selectedUserId}
            onMessage={setMsg}
            onUserUpdated={(u) => setUsers((prev) => prev.map((x) => (x.id === u.id ? u : x)))}
          />
        )}

        {tab === 'users' && (
          <div className="space-y-4">
            <div className="card flex flex-wrap gap-2">
              <input
                className="input flex-1 min-w-[180px]"
                placeholder="Rechercher nom, email, ID…"
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
              />
              <select className="input w-auto" value={filterRole} onChange={(e) => setFilterRole(e.target.value)}>
                <option value="">Tous rôles</option>
                <option value="user">User</option>
                <option value="moderator">Modérateur</option>
                <option value="admin">Admin</option>
              </select>
              <select className="input w-auto" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                <option value="">Tous statuts</option>
                <option value="active">Actif</option>
                <option value="suspended">Suspendu</option>
                <option value="banned">Banni</option>
              </select>
              <button type="button" className="btn-primary" onClick={() => refreshUsers()}>
                Filtrer
              </button>
            </div>
            <div className="overflow-x-auto card p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-500 border-b border-milou-border">
                    <th className="text-left p-3">Utilisateur</th>
                    <th className="text-left">Statut</th>
                    <th className="text-right">Solde</th>
                    <th className="text-left">Premium</th>
                    <th className="text-left">Rôle</th>
                    <th className="text-right p-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b border-milou-border/50">
                      <td className="p-3">
                        <p className="font-medium">{u.firstname} {u.lastname}</p>
                        <p className="text-gray-500 text-xs">{u.email}</p>
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            u.status === 'banned'
                              ? 'bg-red-500/20 text-red-400'
                              : u.status === 'suspended'
                                ? 'bg-amber-500/20 text-amber-400'
                                : 'bg-green-500/20 text-green-400'
                          }`}
                        >
                          {u.status ?? 'active'}
                        </span>
                      </td>
                      <td className="text-right text-cyan-400">{u.balance.toFixed(2)} M</td>
                      <td>
                        {u.isPremium ? (
                          <span className="badge bg-amber-500/20 text-amber-300">⭐ Premium</span>
                        ) : (
                          <span className="text-gray-600 text-xs">—</span>
                        )}
                      </td>
                      <td className="capitalize">{u.role}</td>
                      <td className="text-right p-3">
                        <button
                          type="button"
                          className="text-violet-400 text-xs hover:underline"
                          onClick={() => {
                            setSelectedUserId(u.id);
                            setTab('inspector');
                          }}
                        >
                          Examiner
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'transactions' && (
          <div className="space-y-4">
            <div className="card flex flex-wrap gap-2 items-end">
              <div>
                <label className="label">Type</label>
                <select className="input" value={txType} onChange={(e) => setTxType(e.target.value)}>
                  <option value="">Tous</option>
                  <option value="transfer">Transfert</option>
                  <option value="admin_adjustment">Ajustement admin</option>
                  <option value="escrow_hold">Escrow</option>
                  <option value="escrow_release">Release</option>
                  <option value="registration">Inscription</option>
                </select>
              </div>
              <div>
                <label className="label">Montant min. (suspect)</label>
                <input className="input w-28" type="number" value={txMin} onChange={(e) => setTxMin(e.target.value)} placeholder="50" />
              </div>
              <button type="button" className="btn-primary" onClick={loadTransactions}>
                Appliquer filtres
              </button>
            </div>
            <div className="card max-h-[32rem] overflow-y-auto">
              <TransactionList transactions={transactions} />
            </div>
          </div>
        )}

        {tab === 'listings' && (
          <div className="space-y-3">
            {listings.map((l) => (
              <div key={l._id} className="card flex flex-wrap justify-between gap-2">
                <div>
                  <p className="font-medium">{l.title}</p>
                  <p className="text-sm text-gray-400">
                    {l.status} · {l.price} M ·{' '}
                    {typeof l.userId === 'object' && l.userId?.email ? l.userId.email : '—'}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {['open', 'closed', 'moderated'].map((s) => (
                    <button
                      key={s}
                      type="button"
                      className="btn-secondary text-xs py-1"
                      onClick={async () => {
                        await adminApi.moderateListing(l._id, s);
                        const r = await adminApi.listings();
                        setListings(r.listings);
                        setMsg(`Annonce → ${s}`);
                      }}
                    >
                      {s}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="text-xs text-milou-danger hover:underline"
                    onClick={async () => {
                      if (!confirm('Supprimer cette annonce ?')) return;
                      await adminApi.deleteListing(l._id);
                      setListings((prev) => prev.filter((x) => x._id !== l._id));
                      setMsg('Annonce supprimée');
                    }}
                  >
                    Supprimer
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'missions' && (
          <div className="grid lg:grid-cols-2 gap-4">
            <div className="space-y-2">
              {missions.map((m) => {
                const disputed = m.status === 'disputed';
                const disputeReason =
                  typeof (m as { disputeReason?: string }).disputeReason === 'string'
                    ? (m as { disputeReason: string }).disputeReason
                    : '';
                return (
                <div
                  key={m._id}
                  className={`card text-sm ${disputed ? 'border-amber-500/40 bg-amber-500/5' : ''}`}
                >
                  <p className="font-medium">Mission {m._id.slice(0, 10)}…</p>
                  <p className="text-gray-400">
                    {m.status} · {m.amount} M
                    {disputed && <span className="text-amber-300 ml-2">· Litige</span>}
                  </p>
                  <p className="text-gray-500 text-xs mt-1">
                    {m.clientId.email} ↔ {m.providerId.email}
                  </p>
                  {disputed && disputeReason && (
                    <p className="text-xs text-amber-200/90 mt-2 whitespace-pre-wrap border-t border-amber-500/20 pt-2">
                      Motif client : {disputeReason}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2 mt-2">
                    <button type="button" className="btn-secondary text-xs py-1" onClick={() => openMissionChat(m._id)}>
                      Lire le chat
                    </button>
                    {disputed ? (
                      <>
                        <button
                          type="button"
                          className="btn-primary text-xs py-1"
                          onClick={async () => {
                            if (!confirm('Libérer le paiement au prestataire ?')) return;
                            await adminApi.resolveDispute(m._id, 'release');
                            const r = await adminApi.missions();
                            setMissions(r.missions);
                            setMsg('Litige tranché — prestataire payé');
                          }}
                        >
                          Valider la transaction
                        </button>
                        <button
                          type="button"
                          className="btn-secondary text-xs py-1 border-red-500/30 text-red-300"
                          onClick={async () => {
                            if (!confirm('Rembourser le client et annuler la mission ?')) return;
                            await adminApi.resolveDispute(m._id, 'refund');
                            const r = await adminApi.missions();
                            setMissions(r.missions);
                            setMsg('Litige tranché — client remboursé');
                          }}
                        >
                          Refuser la transaction
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="btn-secondary text-xs py-1"
                        onClick={async () => {
                          await adminApi.updateMission(m._id, 'cancelled');
                          const r = await adminApi.missions();
                          setMissions(r.missions);
                          setMsg('Mission annulée');
                        }}
                      >
                        Annuler
                      </button>
                    )}
                  </div>
                </div>
              );
              })}
            </div>
            <div className="card max-h-96 overflow-y-auto">
              <h3 className="font-semibold mb-2 text-violet-300">
                Chat {chatMissionId ? `(${chatMissionId.slice(0, 8)}…)` : ''}
              </h3>
              {!chatMissionId ? (
                <p className="text-gray-500 text-sm">Sélectionnez « Lire le chat » sur une mission</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {chatMessages.map((msgItem) => (
                    <li key={msgItem._id} className="border-b border-milou-border/50 pb-2 group">
                      <div className="flex justify-between gap-2">
                        <span className="text-cyan-400">{msgItem.senderName}</span>
                        {msgItem.senderId !== 'system' && chatMissionId && (
                          <button
                            type="button"
                            className="text-xs text-red-400 opacity-70 hover:opacity-100"
                            onClick={async () => {
                              if (!confirm('Supprimer ce message ?')) return;
                              await chatApi.deleteMessage(chatMissionId, msgItem._id);
                              setChatMessages((prev) => prev.filter((x) => x._id !== msgItem._id));
                              setMsg('Message supprimé');
                            }}
                          >
                            Supprimer
                          </button>
                        )}
                      </div>
                      <span className="text-gray-600 text-xs">
                        {new Date(msgItem.createdAt).toLocaleString('fr-FR')}
                      </span>
                      <div className="text-gray-300 mt-0.5">
                        <ChatMessageContent text={msgItem.text} attachments={msgItem.attachments} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {tab === 'review-reports' && (
          <div className="space-y-3">
            <p className="text-sm text-gray-400">
              Avis signalés par les utilisateurs — examinez et supprimez si nécessaire (note recalculée
              automatiquement).
            </p>
            {reviewReports.length === 0 ? (
              <p className="text-gray-500 text-sm card">Aucun signalement en attente.</p>
            ) : (
              reviewReports.map((rep) => {
                const snap = rep.reviewSnapshot;
                return (
                  <div key={rep._id} className="card border-amber-500/30 text-sm space-y-2">
                    <div className="flex flex-wrap justify-between gap-2">
                      <span className="badge bg-amber-500/20 text-amber-300">En attente</span>
                      <span className="text-xs text-gray-500">
                        {new Date(rep.createdAt).toLocaleString('fr-FR')}
                      </span>
                    </div>
                    <p className="text-gray-400">
                      Signalé par{' '}
                      <strong className="text-white">
                        {rep.reporter?.firstname} {rep.reporter?.lastname}
                      </strong>{' '}
                      ({rep.reporter?.email})
                    </p>
                    <p>
                      <span className="text-gray-500">Motif : </span>
                      {REPORT_REASON_LABELS[rep.reason] || rep.reason}
                    </p>
                    <p className="text-gray-300 bg-milou-bg p-2 rounded-lg">{rep.details}</p>
                    {snap && (
                      <div className="border border-milou-border rounded-lg p-3 bg-milou-bg/50">
                        <p className="text-amber-400 text-xs mb-1">Avis concerné</p>
                        <p>
                          {snap.rating === 0 ? '☆☆☆☆☆ (0/5)' : `${snap.rating}/5`} — par {snap.fromName}
                          {snap.autoPenalty && ' (automatique)'}
                        </p>
                        {snap.comment && <p className="text-gray-400 mt-1 italic">&quot;{snap.comment}&quot;</p>}
                        <p className="text-xs text-gray-600 mt-1">ID avis : {rep.reviewId}</p>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2 pt-2">
                      <button
                        type="button"
                        className="btn-primary text-xs py-1.5 bg-red-600/80 hover:bg-red-600"
                        onClick={async () => {
                          if (!confirm('Supprimer définitivement cet avis ?')) return;
                          await adminApi.deleteReview(rep.reviewId);
                          setReviewReports((prev) => prev.filter((x) => x._id !== rep._id));
                          setMsg('Avis supprimé — profil utilisateur mis à jour');
                        }}
                      >
                        Supprimer l&apos;avis
                      </button>
                      <button
                        type="button"
                        className="btn-secondary text-xs py-1.5"
                        onClick={async () => {
                          const r = await adminApi.reviewReports('pending');
                          setReviewReports(r.reports);
                        }}
                      >
                        Actualiser
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {tab === 'audit' && (
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 border-b border-milou-border">
                  <th className="text-left p-2">Date</th>
                  <th className="text-left">Modérateur</th>
                  <th className="text-left">Action</th>
                  <th className="text-left">Cible</th>
                </tr>
              </thead>
              <tbody>
                {audit.map((e) => (
                  <tr key={e._id} className="border-b border-milou-border/40">
                    <td className="p-2 text-xs">{new Date(e.createdAt).toLocaleString('fr-FR')}</td>
                    <td>{e.adminName}</td>
                    <td className="font-mono text-xs text-violet-300">{e.action}</td>
                    <td className="text-xs">
                      {e.targetType}/{e.targetId.slice(0, 12)}…
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'announcements' && (
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="card space-y-3">
              <h3 className="font-semibold text-violet-300">Nouvelle annonce plateforme</h3>
              <input className="input" placeholder="Titre" value={annTitle} onChange={(e) => setAnnTitle(e.target.value)} />
              <textarea
                className="input min-h-[100px]"
                placeholder="Message visible par tous les utilisateurs connectés"
                value={annMessage}
                onChange={(e) => setAnnMessage(e.target.value)}
              />
              <button
                type="button"
                className="btn-primary"
                onClick={async () => {
                  await adminApi.createAnnouncement({ title: annTitle, message: annMessage, active: true });
                  setAnnTitle('');
                  setAnnMessage('');
                  const r = await adminApi.announcements();
                  setAnnouncements(r.announcements);
                  setMsg('Annonce publiée');
                }}
              >
                Publier (active)
              </button>
            </div>
            <div className="space-y-2">
              {announcements.map((a) => (
                <div key={a._id} className={`card text-sm ${a.active ? 'border-green-500/40' : ''}`}>
                  <p className="font-medium">{a.title}</p>
                  <p className="text-gray-400 mt-1">{a.message}</p>
                  <p className="text-xs text-gray-600 mt-2">
                    {a.active ? 'Active' : 'Inactive'} · {new Date(a.createdAt).toLocaleDateString('fr-FR')}
                  </p>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {!a.active && (
                      <button
                        type="button"
                        className="btn-secondary text-xs py-1"
                        onClick={async () => {
                          await adminApi.setAnnouncementActive(a._id, true);
                          const r = await adminApi.announcements();
                          setAnnouncements(r.announcements);
                          setMsg('Annonce activée');
                        }}
                      >
                        Activer
                      </button>
                    )}
                    <button
                      type="button"
                      className="text-xs text-red-400 border border-red-500/30 px-2 py-1 rounded-lg hover:bg-red-500/10"
                      onClick={async () => {
                        if (!confirm('Supprimer cette annonce plateforme ?')) return;
                        await adminApi.deleteAnnouncement(a._id);
                        setAnnouncements((prev) => prev.filter((x) => x._id !== a._id));
                        setMsg('Annonce plateforme supprimée — le bandeau disparaît au prochain chargement');
                      }}
                    >
                      Supprimer
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'codes' && (
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="card space-y-3 border-amber-500/20">
              <h3 className="font-semibold text-amber-300">Créer un code promo</h3>
              <input
                className="input font-mono uppercase"
                placeholder="CODE (ex: MILOU50)"
                value={codeForm.code}
                onChange={(e) => setCodeForm({ ...codeForm, code: e.target.value.toUpperCase() })}
              />
              <input
                className="input"
                placeholder="Description interne"
                value={codeForm.label}
                onChange={(e) => setCodeForm({ ...codeForm, label: e.target.value })}
              />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Milou à gagner</label>
                  <input
                    className="input"
                    type="number"
                    min={0}
                    value={codeForm.milouAmount}
                    onChange={(e) => setCodeForm({ ...codeForm, milouAmount: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="label">Jours Premium</label>
                  <input
                    className="input"
                    type="number"
                    min={0}
                    value={codeForm.premiumDays}
                    onChange={(e) => setCodeForm({ ...codeForm, premiumDays: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="label">Bonus réputation</label>
                  <input
                    className="input"
                    type="number"
                    min={0}
                    value={codeForm.reputationBonus}
                    onChange={(e) => setCodeForm({ ...codeForm, reputationBonus: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="label">Utilisations max (0 = illimité)</label>
                  <input
                    className="input"
                    type="number"
                    min={0}
                    value={codeForm.maxUses}
                    onChange={(e) => setCodeForm({ ...codeForm, maxUses: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="label">Max / utilisateur</label>
                  <input
                    className="input"
                    type="number"
                    min={1}
                    value={codeForm.maxUsesPerUser}
                    onChange={(e) => setCodeForm({ ...codeForm, maxUsesPerUser: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="label">Compte min. (jours)</label>
                  <input
                    className="input"
                    type="number"
                    min={0}
                    value={codeForm.minAccountAgeDays}
                    onChange={(e) => setCodeForm({ ...codeForm, minAccountAgeDays: Number(e.target.value) })}
                  />
                </div>
              </div>
              <div>
                <label className="label">Expiration (optionnel)</label>
                <input
                  className="input"
                  type="datetime-local"
                  value={codeForm.expiresAt}
                  onChange={(e) => setCodeForm({ ...codeForm, expiresAt: e.target.value })}
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-400">
                <input
                  type="checkbox"
                  checked={codeForm.active}
                  onChange={(e) => setCodeForm({ ...codeForm, active: e.target.checked })}
                />
                Code actif à la création
              </label>
              <button
                type="button"
                className="btn-primary w-full"
                onClick={async () => {
                  try {
                    await adminApi.createPromoCode({
                      ...codeForm,
                      expiresAt: codeForm.expiresAt || undefined,
                    });
                    const r = await adminApi.promoCodes();
                    setPromoCodes(r.codes);
                    setCodeForm({
                      code: '',
                      label: '',
                      milouAmount: 50,
                      premiumDays: 0,
                      reputationBonus: 0,
                      maxUses: 100,
                      maxUsesPerUser: 1,
                      minAccountAgeDays: 0,
                      expiresAt: '',
                      active: true,
                    });
                    setMsg('Code créé — les utilisateurs peuvent l\'utiliser sur /codes');
                  } catch (e) {
                    setMsg(e instanceof Error ? e.message : 'Erreur');
                  }
                }}
              >
                Créer le code
              </button>
              <p className="text-xs text-gray-600">
                Page utilisateur : <Link href="/codes" className="text-cyan-400">/codes</Link>
              </p>
            </div>
            <div className="space-y-2 max-h-[32rem] overflow-y-auto">
              {promoCodes.length === 0 ? (
                <p className="text-gray-500 text-sm">Aucun code promo.</p>
              ) : (
                promoCodes.map((c) => (
                  <div key={c._id} className={`card text-sm ${c.active ? 'border-amber-500/30' : 'opacity-70'}`}>
                    <p className="font-mono font-bold text-amber-300">{c.code}</p>
                    {c.label && <p className="text-gray-500 text-xs">{c.label}</p>}
                    <p className="text-gray-400 mt-2">
                      {c.milouAmount > 0 && `${c.milouAmount} M `}
                      {c.premiumDays > 0 && `· ${c.premiumDays}j Premium `}
                      {c.reputationBonus > 0 && `· +${c.reputationBonus} rep.`}
                    </p>
                    <p className="text-xs text-gray-600 mt-1">
                      {c.usedCount}/{c.maxUses || '∞'} utilisations · max {c.maxUsesPerUser}/pers.
                      {c.expiresAt && ` · expire ${new Date(c.expiresAt).toLocaleDateString('fr-FR')}`}
                    </p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <button
                        type="button"
                        className="btn-secondary text-xs py-1"
                        onClick={async () => {
                          await adminApi.updatePromoCode(c._id, { active: !c.active });
                          const r = await adminApi.promoCodes();
                          setPromoCodes(r.codes);
                        }}
                      >
                        {c.active ? 'Désactiver' : 'Activer'}
                      </button>
                      <button
                        type="button"
                        className="text-xs text-red-400 px-2 py-1 border border-red-500/30 rounded-lg"
                        onClick={async () => {
                          if (!confirm(`Supprimer le code ${c.code} ?`)) return;
                          await adminApi.deletePromoCode(c._id);
                          setPromoCodes((prev) => prev.filter((x) => x._id !== c._id));
                          setMsg('Code supprimé');
                        }}
                      >
                        Supprimer
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </main>
    </>
  );
}
