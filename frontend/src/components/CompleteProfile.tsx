'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getFirebaseAuth } from '@/lib/firebase/client';
import { sendVerificationEmail } from '@/lib/firebase/email-verification';
import { useAuth } from '@/context/AuthContext';
import { formatAuthError } from '@/lib/firebase/errors';

export default function CompleteProfile() {
  const { refreshUser } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({ firstname: '', lastname: '', postalCode: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const auth = getFirebaseAuth();
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error('Session expirée, reconnectez-vous.');

      const res = await fetch('/api/auth/setup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur');

      const current = auth.currentUser;
      if (current && !current.emailVerified) {
        try {
          await sendVerificationEmail(current);
        } catch {
          /* renvoi possible sur /verify-email */
        }
        router.push('/verify-email');
        return;
      }
      await refreshUser();
      router.push('/dashboard');
    } catch (err) {
      setError(formatAuthError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="card max-w-md w-full">
        <h1 className="text-xl font-bold mb-2">Finaliser votre compte</h1>
        <p className="text-gray-400 text-sm mb-6">
          Vous êtes connecté, mais votre profil MILOU n&apos;a pas encore été créé dans la base de données.
          Complétez ce formulaire pour recevoir vos <strong className="text-emerald-400">10 Milou</strong>.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Prénom</label>
            <input
              className="input"
              value={form.firstname}
              onChange={(e) => setForm({ ...form, firstname: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="label">Nom</label>
            <input
              className="input"
              value={form.lastname}
              onChange={(e) => setForm({ ...form, lastname: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="label">Code postal</label>
            <input
              className="input"
              value={form.postalCode}
              onChange={(e) => setForm({ ...form, postalCode: e.target.value })}
              required
              inputMode="numeric"
              autoComplete="postal-code"
              placeholder="Ex : 75001"
            />
          </div>
          {error && <p className="text-milou-danger text-sm">{error}</p>}
          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? 'Création du profil…' : 'Activer mon compte'}
          </button>
        </form>
      </div>
    </main>
  );
}
