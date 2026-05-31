'use client';

import { useEffect, useState } from 'react';
import Navbar from '@/components/Navbar';
import AppShell from '@/components/AppShell';
import TransactionList from '@/components/TransactionList';
import { userApi } from '@/lib/api';
import { Transaction } from '@/lib/types';
import { useAuth } from '@/context/AuthContext';

export default function TransactionsPage() {
  const { user, loading } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  useEffect(() => {
    if (!user) return;
    userApi.transactions().then((d) => setTransactions(d.transactions)).catch(console.error);
  }, [user]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-milou-bg">
        <p className="text-zinc-500">Chargement…</p>
      </div>
    );
  }

  return (
    <>
      <Navbar />
      <AppShell title="Historique Milou" subtitle="Tous vos transferts, missions et mouvements de solde">
        <section className="card">
          <TransactionList transactions={transactions} />
        </section>
      </AppShell>
    </>
  );
}
