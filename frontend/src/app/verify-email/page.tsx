'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';
import AuthLayout from '@/components/AuthLayout';
import { getFirebaseAuth, isFirebaseConfigured } from '@/lib/firebase/client';
import { sendVerificationEmail } from '@/lib/firebase/email-verification';
import { formatAuthError } from '@/lib/firebase/errors';

export default function VerifyEmailPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (!isFirebaseConfigured()) return;
    const auth = getFirebaseAuth();
    const user = auth.currentUser;
    if (!user) {
      router.replace('/login');
      return;
    }
    setEmail(user.email || '');
    if (user.emailVerified) {
      router.replace('/dashboard');
    }
  }, [router]);

  async function handleResend() {
    setError('');
    setMsg('');
    setLoading(true);
    try {
      const user = getFirebaseAuth().currentUser;
      if (!user) throw new Error('Session expirée. Reconnectez-vous.');
      await sendVerificationEmail(user);
      setMsg('E-mail de vérification envoyé. Consultez votre boîte de réception (et les spams).');
    } catch (err) {
      setError(formatAuthError(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleChecked() {
    setError('');
    setChecking(true);
    try {
      const auth = getFirebaseAuth();
      const user = auth.currentUser;
      if (!user) throw new Error('Session expirée. Reconnectez-vous.');
      await user.reload();
      if (auth.currentUser?.emailVerified) {
        setMsg('E-mail vérifié ! Redirection…');
        router.replace('/dashboard');
      } else {
        setError('Pas encore vérifié. Cliquez sur le lien dans l’e-mail, puis réessayez.');
      }
    } catch (err) {
      setError(formatAuthError(err));
    } finally {
      setChecking(false);
    }
  }

  async function handleLogout() {
    await signOut(getFirebaseAuth());
    router.push('/login');
  }

  return (
    <AuthLayout
      title="Vérifiez votre e-mail"
      subtitle="Un lien de confirmation a été envoyé pour sécuriser votre compte MILOU"
    >
      <div className="space-y-4 text-sm text-zinc-400">
        <p>
          Nous avons envoyé un message à{' '}
          <strong className="text-white">{email || 'votre adresse'}</strong>. Ouvrez-le et cliquez sur le
          lien de vérification.
        </p>
        <p className="text-xs text-zinc-500">
          L’e-mail part de Firebase (noreply@…). Pensez à regarder les courriers indésirables.
        </p>
      </div>

      {msg && <p className="text-emerald-400 text-sm mt-4">{msg}</p>}
      {error && <p className="text-red-400 text-sm mt-4 whitespace-pre-line">{error}</p>}

      <div className="flex flex-col gap-2 mt-6">
        <button type="button" className="btn-primary w-full py-3" onClick={handleChecked} disabled={checking}>
          {checking ? 'Vérification…' : 'J’ai cliqué sur le lien'}
        </button>
        <button type="button" className="btn-secondary w-full py-3" onClick={handleResend} disabled={loading}>
          {loading ? 'Envoi…' : 'Renvoyer l’e-mail'}
        </button>
        <button type="button" className="text-zinc-500 text-sm hover:text-zinc-300 mt-2" onClick={handleLogout}>
          Utiliser un autre compte
        </button>
      </div>

      <p className="mt-6 text-sm text-zinc-500 text-center">
        <Link href="/login" className="text-indigo-400 hover:text-indigo-300 font-medium">
          Retour connexion
        </Link>
      </p>
    </AuthLayout>
  );
}
