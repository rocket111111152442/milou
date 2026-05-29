'use client';

import { useState } from 'react';
import Navbar from '@/components/Navbar';
import BalanceCard from '@/components/BalanceCard';
import { useAuth } from '@/context/AuthContext';
import { txApi } from '@/lib/api';

export default function TransferPage() {
  const { user, loading, refreshUser } = useAuth();
  const [email, setEmail] = useState('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  if (loading || !user) {
    return <div className="min-h-screen flex items-center justify-center text-cyan-400">Chargement...</div>;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setError('');
    setSuccess('');
    const num = parseFloat(amount);
    if (num <= 0 || num > user.balance) {
      setError('Montant invalide ou solde insuffisant');
      return;
    }
    try {
      const { balance } = await txApi.transfer({ recipientEmail: email, amount: num });
      setSuccess(`Transfert réussi ! Nouveau solde : ${balance.toFixed(2)} M`);
      setEmail('');
      setAmount('');
      await refreshUser();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    }
  }

  return (
    <>
      <Navbar />
      <main className="max-w-lg mx-auto px-4 py-8 space-y-6">
        <h1 className="text-2xl font-bold">Transférer des Milou</h1>
        <BalanceCard balance={user.balance} />
        <form onSubmit={handleSubmit} className="card space-y-4">
          <div>
            <label className="label">Email du destinataire</label>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <label className="label">Montant (Milou)</label>
            <input className="input" type="number" step="0.01" min="0.01" max={user.balance} value={amount} onChange={(e) => setAmount(e.target.value)} required />
          </div>
          {error && <p className="text-milou-danger text-sm">{error}</p>}
          {success && <p className="text-milou-success text-sm">{success}</p>}
          <button type="submit" className="btn-primary w-full">Envoyer</button>
        </form>
        <p className="text-xs text-gray-500 text-center">
          Les transferts sont irréversibles. Vérifiez l&apos;email du destinataire.
        </p>
      </main>
    </>
  );
}
