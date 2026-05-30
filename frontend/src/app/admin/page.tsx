'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import AdminUserInspector from '@/components/admin/AdminUserInspector';
import TransactionList from '@/components/TransactionList';
import { useAuth } from '@/context/AuthContext';
import { adminApi } from '@/lib/api';
import type {
  AdminAuditEntry,
  AdminStats,
  Listing,
  Mission,
  MissionMessage,
  PlatformAnnouncement,
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
  'Annonces plateforme',
];

type Tab =
  | 'dashboard'
  | 'inspector'
  | 'users'
  | 'transactions'
  | 'listings'
  | 'missions'
  | 'audit'
  | 'announcements';

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
    const [s, u, t, l, m, a, an] = await Promise.all([
      adminApi.stats(),
      adminApi.users(),
      adminApi.transactions(),
      adminApi.listings(),
      adminApi.missions(),
      adminApi.audit(),
      adminApi.announcements(),
    ]);
    setStats(s.stats);
    setUsers(u.users);
    setTransactions(t.transactions);
    setListings(l.listings);
    setMissions(m.missions);
    setAudit(a.entries);
    setAnnouncements(an.announcements);
  }, []);

  useEffect(() => {
    if (!loading && user && !isStaff(user.role)) router.push('/dashboard');
  }, [user, loading, router]);

  useEffect(() => {
    if (!isStaff(user?.role)) return;
    loadAll().catch((e) => setMsg(e instanceof Error ? e.message : 'Erreur'));
  }, [user, loadAll]);

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
  ];

  return (
    <>
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-violet-400">Panel Modération MILOU</h1>
        <p className="text-gray-400 text-sm mb-2">
          {MOD_FEATURES.length} outils modérateur — examen précis des comptes, économie, annonces et missions
        </p>
        <details className="mb-4 text-xs text-gray-500">
          <summary className="cursor-pointer text-violet-400/80">Liste des fonctionnalités</summary>
          <ol className="mt-2 grid sm:grid-cols-2 gap-1 list-decimal list-inside">
            {MOD_FEATURES.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ol>
        </details>

        {msg && (
          <p className="mb-4 text-sm text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 rounded-lg px-3 py-2">
            {msg}
          </p>
        )}

        <div className="flex flex-wrap gap-2 mb-6">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`px-3 py-2 rounded-lg text-sm whitespace-nowrap ${
                tab === t.id ? 'bg-violet-500/20 text-violet-300' : 'bg-milou-card text-gray-400'
              }`}
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
                    {l.status} · {l.price} M · {l.userId.email}
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
              {missions.map((m) => (
                <div key={m._id} className="card text-sm">
                  <p className="font-medium">Mission {m._id.slice(0, 10)}…</p>
                  <p className="text-gray-400">{m.status} · {m.amount} M</p>
                  <p className="text-gray-500 text-xs mt-1">
                    {m.clientId.email} ↔ {m.providerId.email}
                  </p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <button type="button" className="btn-secondary text-xs py-1" onClick={() => openMissionChat(m._id)}>
                      Lire le chat
                    </button>
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
                  </div>
                </div>
              ))}
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
                    <li key={msgItem._id} className="border-b border-milou-border/50 pb-2">
                      <span className="text-cyan-400">{msgItem.senderName}</span>
                      <span className="text-gray-600 text-xs ml-2">
                        {new Date(msgItem.createdAt).toLocaleString('fr-FR')}
                      </span>
                      <p className="text-gray-300 mt-0.5">{msgItem.text}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
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
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </>
  );
}
