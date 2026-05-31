'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { getFirebaseAuth, getFirebaseConfigError, isFirebaseConfigured } from '@/lib/firebase/client';
import { formatAuthError } from '@/lib/firebase/errors';
import AuthLayout from '@/components/AuthLayout';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState('');
  const router = useRouter();

  useEffect(() => {
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('verified') === '1') {
      setInfo('E-mail vérifié. Vous pouvez vous connecter.');
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!isFirebaseConfigured()) {
      setError(getFirebaseConfigError());
      return;
    }
    setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(getFirebaseAuth(), email, password);
      if (!cred.user.emailVerified) {
        router.push('/verify-email');
        return;
      }
      router.push('/dashboard');
    } catch (err) {
      setError(formatAuthError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout title="Connexion" subtitle="Accédez à votre espace MILOU">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Email</label>
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        </div>
        <div>
          <label className="label">Mot de passe</label>
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
        </div>
        {info && !error && <p className="text-emerald-400 text-sm">{info}</p>}
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <button type="submit" className="btn-primary w-full py-3" disabled={loading}>
          {loading ? 'Connexion…' : 'Se connecter'}
        </button>
      </form>
      <p className="mt-6 text-sm text-zinc-500 text-center">
        Pas de compte ?{' '}
        <Link href="/register" className="text-indigo-400 hover:text-indigo-300 font-medium">
          S&apos;inscrire gratuitement
        </Link>
      </p>
    </AuthLayout>
  );
}
