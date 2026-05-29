'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import TransactionList from '@/components/TransactionList';
import { useAuth } from '@/context/AuthContext';
import { adminApi } from '@/lib/api';
import { User, Transaction, Listing } from '@/lib/types';

export default function AdminPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<'users' | 'transactions' | 'listings'>('users');
  const [users, setUsers] = useState<User[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [adjustId, setAdjustId] = useState('');
  const [adjustAmount, setAdjustAmount] = useState('10');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (!loading && user && user.role !== 'admin') router.push('/dashboard');
  }, [user, loading, router]);

  useEffect(() => {
    if (user?.role !== 'admin') return;
    adminApi.users().then((r) => setUsers(r.users));
    adminApi.transactions().then((r) => setTransactions(r.transactions));
    adminApi.listings().then((r) => setListings(r.listings));
  }, [user]);

  async function adjust(action: 'add' | 'remove') {
    if (!adjustId) return;
    try {
      await adminApi.adjustBalance(adjustId, parseFloat(adjustAmount), action);
      setMsg(`Solde ${action === 'add' ? 'ajouté' : 'retiré'} avec succès`);
      const r = await adminApi.users();
      setUsers(r.users);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Erreur');
    }
  }

  if (loading || !user || user.role !== 'admin') {
    return <div className="min-h-screen flex items-center justify-center text-cyan-400">Chargement...</div>;
  }

  return (
    <>
      <Navbar />
      <main className="max-w-6xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-2 text-violet-400">Panel Admin</h1>
        <p className="text-gray-400 mb-6">Gestion utilisateurs, transactions et modération</p>

        <div className="flex gap-2 mb-6">
          {(['users', 'transactions', 'listings'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm capitalize ${
                tab === t ? 'bg-violet-500/20 text-violet-300' : 'bg-milou-card text-gray-400'
              }`}
            >
              {t === 'users' ? 'Utilisateurs' : t === 'transactions' ? 'Transactions' : 'Annonces'}
            </button>
          ))}
        </div>

        {msg && <p className="mb-4 text-cyan-400 text-sm">{msg}</p>}

        {tab === 'users' && (
          <div className="space-y-6">
            <div className="card flex flex-wrap gap-3 items-end">
              <div className="flex-1 min-w-[200px]">
                <label className="label">ID utilisateur</label>
                <input className="input" value={adjustId} onChange={(e) => setAdjustId(e.target.value)} placeholder="Coller l'ID" />
              </div>
              <div className="w-24">
                <label className="label">Montant</label>
                <input className="input" type="number" value={adjustAmount} onChange={(e) => setAdjustAmount(e.target.value)} />
              </div>
              <button onClick={() => adjust('add')} className="btn-primary">Ajouter</button>
              <button onClick={() => adjust('remove')} className="btn-secondary">Retirer</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-500 border-b border-milou-border">
                    <th className="text-left py-2">Nom</th>
                    <th className="text-left">Email</th>
                    <th className="text-right">Solde</th>
                    <th className="text-left">Rôle</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b border-milou-border/50">
                      <td className="py-3">{u.firstname} {u.lastname}</td>
                      <td>{u.email}</td>
                      <td className="text-right text-cyan-400">{u.balance.toFixed(2)} M</td>
                      <td>{u.role}</td>
                      <td className="text-right">
                        <button
                          className="text-xs text-milou-danger hover:underline"
                          onClick={async () => {
                            if (!confirm('Supprimer cet utilisateur ?')) return;
                            await adminApi.deleteUser(u.id);
                            setUsers((prev) => prev.filter((x) => x.id !== u.id));
                          }}
                        >
                          Supprimer
                        </button>
                        <button
                          className="text-xs text-cyan-400 ml-2 hover:underline"
                          onClick={() => setAdjustId(u.id)}
                        >
                          Ajuster
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
          <div className="card">
            <TransactionList transactions={transactions} />
          </div>
        )}

        {tab === 'listings' && (
          <div className="space-y-3">
            {listings.map((l) => (
              <div key={l._id} className="card flex flex-wrap justify-between gap-2">
                <div>
                  <p className="font-medium">{l.title}</p>
                  <p className="text-sm text-gray-400">{l.status} · {l.price} M</p>
                </div>
                <div className="flex gap-2">
                  {['open', 'closed', 'moderated'].map((s) => (
                    <button
                      key={s}
                      className="btn-secondary text-xs py-1"
                      onClick={async () => {
                        await adminApi.moderateListing(l._id, s);
                        const r = await adminApi.listings();
                        setListings(r.listings);
                      }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
