'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { getFirebaseAuth, getFirebaseConfigError, isFirebaseConfigured } from '@/lib/firebase/client';
import { formatAuthError } from '@/lib/firebase/errors';
import AuthLayout from '@/components/AuthLayout';

export default function RegisterPage() {
  const [form, setForm] = useState({ firstname: '', lastname: '', email: '', password: '', postalCode: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!isFirebaseConfigured()) {
      setError(getFirebaseConfigError());
      return;
    }

    const email = form.email.trim().toLowerCase();
    setLoading(true);

    try {
      setStatus('Création du compte…');
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstname: form.firstname.trim(),
          lastname: form.lastname.trim(),
          email,
          password: form.password,
          postalCode: form.postalCode.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Inscription refusée');
      }

      setStatus('Connexion…');
      try {
        await signInWithEmailAndPassword(getFirebaseAuth(), email, form.password);
        router.push('/dashboard');
      } catch (signInErr) {
        const code =
          signInErr && typeof signInErr === 'object' && 'code' in signInErr
            ? String((signInErr as { code: string }).code)
            : '';
        if (code === 'auth/network-request-failed') {
          setError(
            'Compte créé sur le serveur, mais le navigateur ne joint pas Firebase Auth. ' +
              'Console Firebase → Authentication → Paramètres → Domaines autorisés : ajoutez « localhost ». ' +
              'Puis allez sur Connexion.'
          );
        } else {
          throw signInErr;
        }
      }
    } catch (err) {
      setError(formatAuthError(err));
    } finally {
      setLoading(false);
      if (!error) setStatus('');
    }
  }

  return (
    <AuthLayout title="Créer un compte" subtitle="10 Milou offerts à l'inscription — gratuit, sans carte bancaire">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Prénom</label>
            <input className="input" value={form.firstname} onChange={(e) => setForm({ ...form, firstname: e.target.value })} required autoComplete="given-name" />
          </div>
          <div>
            <label className="label">Nom</label>
            <input className="input" value={form.lastname} onChange={(e) => setForm({ ...form, lastname: e.target.value })} required autoComplete="family-name" />
          </div>
        </div>
        <div>
          <label className="label">Email</label>
          <input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required autoComplete="email" />
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
        <div>
          <label className="label">Mot de passe (min. 6 caractères)</label>
          <input className="input" type="password" minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required autoComplete="new-password" />
        </div>
        {error && <p className="text-red-400 text-sm whitespace-pre-line">{error}</p>}
        {status && !error && <p className="text-indigo-400 text-sm">{status}</p>}
        <button type="submit" className="btn-primary w-full py-3" disabled={loading}>
          {loading ? status || 'Création…' : 'Créer mon compte'}
        </button>
      </form>
      <p className="mt-6 text-sm text-zinc-500 text-center">
        Déjà inscrit ?{' '}
        <Link href="/login" className="text-indigo-400 hover:text-indigo-300 font-medium">
          Connexion
        </Link>
      </p>
    </AuthLayout>
  );
}
