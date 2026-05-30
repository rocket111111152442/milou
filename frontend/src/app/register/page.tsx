'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { getFirebaseAuth, getFirebaseConfigError, isFirebaseConfigured } from '@/lib/firebase/client';
import { formatAuthError } from '@/lib/firebase/errors';

export default function RegisterPage() {
  const [form, setForm] = useState({ firstname: '', lastname: '', email: '', password: '' });
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
      setStatus('Création du compte (serveur)…');
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstname: form.firstname.trim(),
          lastname: form.lastname.trim(),
          email,
          password: form.password,
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
    <main className="min-h-screen flex items-center justify-center px-4 py-8">
      <div className="card w-full max-w-md">
        <Link href="/" className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-violet-400 bg-clip-text text-transparent">
          MILOU
        </Link>
        <h1 className="text-xl font-semibold mt-6 mb-2">Créer un compte</h1>
        <p className="text-cyan-400/80 text-sm mb-6">Bonus : 10 Milou offerts à l&apos;inscription</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Prénom</label>
              <input className="input" value={form.firstname} onChange={(e) => setForm({ ...form, firstname: e.target.value })} required />
            </div>
            <div>
              <label className="label">Nom</label>
              <input className="input" value={form.lastname} onChange={(e) => setForm({ ...form, lastname: e.target.value })} required />
            </div>
          </div>
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          </div>
          <div>
            <label className="label">Mot de passe (min. 6)</label>
            <input className="input" type="password" minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
          </div>
          {error && <p className="text-milou-danger text-sm whitespace-pre-line">{error}</p>}
          {status && !error && <p className="text-cyan-400/80 text-sm">{status}</p>}
          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? status || 'Création…' : 'S\'inscrire'}
          </button>
        </form>
        <p className="mt-4 text-sm text-gray-500">
          Déjà inscrit ? <Link href="/login" className="text-cyan-400 hover:underline">Connexion</Link>
        </p>
      </div>
    </main>
  );
}
