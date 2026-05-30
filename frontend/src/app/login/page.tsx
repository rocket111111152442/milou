'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { getFirebaseAuth, isFirebaseConfigured } from '@/lib/firebase/client';
import { formatAuthError } from '@/lib/firebase/errors';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
      await signInWithEmailAndPassword(getFirebaseAuth(), email, password);
      router.push('/dashboard');
    } catch (err) {
      setError(formatAuthError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="card w-full max-w-md">
        <Link href="/" className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-violet-400 bg-clip-text text-transparent">
          MILOU
        </Link>
        <h1 className="text-xl font-semibold mt-6 mb-6">Connexion</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <label className="label">Mot de passe</label>
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          {error && <p className="text-milou-danger text-sm">{error}</p>}
          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>
        <p className="mt-4 text-sm text-gray-500">
          Pas de compte ? <Link href="/register" className="text-cyan-400 hover:underline">S&apos;inscrire</Link>
        </p>
      </div>
    </main>
  );
}
