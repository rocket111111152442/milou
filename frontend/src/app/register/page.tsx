'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { getFirebaseAuth, isFirebaseConfigured } from '@/lib/firebase/client';
import { authApi } from '@/lib/api';

export default function RegisterPage() {
  const [form, setForm] = useState({ firstname: '', lastname: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!isFirebaseConfigured()) {
      setError('Firebase non configuré — voir DEPLOY-FIREBASE.md');
      return;
    }
    setLoading(true);
    try {
      await authApi.register(form);
      await signInWithEmailAndPassword(getFirebaseAuth(), form.email, form.password);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setLoading(false);
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
          {error && <p className="text-milou-danger text-sm">{error}</p>}
          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? 'Création...' : 'S\'inscrire'}
          </button>
        </form>
        <p className="mt-4 text-sm text-gray-500">
          Déjà inscrit ? <Link href="/login" className="text-cyan-400 hover:underline">Connexion</Link>
        </p>
      </div>
    </main>
  );
}
