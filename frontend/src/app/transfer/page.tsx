'use client';

import { useState } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import AppShell from '@/components/AppShell';
import BalanceCard from '@/components/BalanceCard';
import { useAuth } from '@/context/AuthContext';
import { txApi } from '@/lib/api';

export default function TransferPage() {
  const { user, loading, refreshUser } = useAuth();
  const [email, setEmail] = useState('');
  const [confirmEmail, setConfirmEmail] = useState('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-milou-bg">
        <p className="text-zinc-500 text-sm">Chargement…</p>
      </div>
    );
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
    if (confirmEmail.trim().toLowerCase() !== email.trim().toLowerCase()) {
      setError('Les deux e-mails ne correspondent pas');
      return;
    }
    try {
      const { balance } = await txApi.transfer({
        recipientEmail: email,
        amount: num,
        confirmEmail: confirmEmail,
      });
      setSuccess(`Transfert réussi ! Nouveau solde : ${balance.toFixed(2)} M`);
      setEmail('');
      setConfirmEmail('');
      setAmount('');
      await refreshUser();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    }
  }

  return (
    <>
      <Navbar />
      <AppShell
        title="Transférer des Milou"
        subtitle="Envoi sécurisé avec double vérification de l'e-mail destinataire"
      >
        <div className="max-w-lg mx-auto space-y-6 animate-fade-up">
          <BalanceCard balance={user.balance} />
          <form onSubmit={handleSubmit} className="card space-y-4">
            <div>
              <label className="label">Email du destinataire</label>
              <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div>
              <label className="label">Confirmer l&apos;e-mail</label>
              <input
                className="input"
                type="email"
                value={confirmEmail}
                onChange={(e) => setConfirmEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="label">Montant (Milou)</label>
              <input
                className="input"
                type="number"
                step="0.01"
                min="0.01"
                max={user.balance}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
              {!user.isPremium && (
                <p className="text-xs text-zinc-500 mt-1.5">Plafond gratuit : 50 M par transfert</p>
              )}
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            {success && <p className="alert-success">{success}</p>}
            <button type="submit" className="btn-primary w-full py-3">
              Envoyer
            </button>
          </form>
          <p className="text-xs text-zinc-500 text-center">
            Transferts sécurisés avec double vérification.{' '}
            <Link href="/premium" className="text-amber-400 hover:text-amber-300">
              Premium
            </Link>{' '}
            pour des limites plus élevées.
          </p>
        </div>
      </AppShell>
    </>
  );
}
