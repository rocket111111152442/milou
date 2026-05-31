'use client';

import { useEffect, useRef, useState } from 'react';
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
  const [sending, setSending] = useState(false);
  const [checking, setChecking] = useState(false);
  const autoSent = useRef(false);

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
      return;
    }
    if (!autoSent.current) {
      autoSent.current = true;
      setSending(true);
      sendVerificationEmail(user)
        .then(() =>
          setMsg(
            'E-mail envoyé par Firebase. Ouvrez-le et cliquez sur le lien de vérification (vérifiez les spams).'
          )
        )
        .catch((err) => setError(formatAuthError(err)))
        .finally(() => setSending(false));
    }
  }, [router]);

  async function handleResend() {
    setError('');
    setMsg('');
    setSending(true);
    try {
      const user = getFirebaseAuth().currentUser;
      if (!user) throw new Error('Session expirée. Reconnectez-vous.');
      await sendVerificationEmail(user);
      setMsg('Nouvel e-mail envoyé. Cliquez sur le lien dans le message.');
    } catch (err) {
      setError(formatAuthError(err));
    } finally {
      setSending(false);
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
        setError(
          'Pas encore vérifié. Ouvrez l’e-mail Firebase (expéditeur noreply@…) et cliquez sur le lien, puis réessayez.'
        );
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
      subtitle="Cliquez sur le lien reçu par e-mail — aucun domaine supplémentaire requis"
    >
      <div className="space-y-2 text-sm text-zinc-400">
        <p>
          Message envoyé à <strong className="text-white">{email || 'votre adresse'}</strong>
          {sending && <span className="text-indigo-400"> — envoi…</span>}
        </p>
        <p className="text-xs text-zinc-500">
          L’e-mail part de Firebase (noreply@…). Consultez aussi les courriers indésirables.
        </p>
      </div>

      {msg && <p className="text-emerald-400 text-sm mt-4">{msg}</p>}
      {error && <p className="text-red-400 text-sm mt-4 whitespace-pre-line">{error}</p>}

      <div className="flex flex-col gap-2 mt-6">
        <button type="button" className="btn-primary w-full py-3" onClick={handleChecked} disabled={checking}>
          {checking ? 'Vérification…' : 'J’ai cliqué sur le lien'}
        </button>
        <button type="button" className="btn-secondary w-full py-3" onClick={handleResend} disabled={sending}>
          {sending ? 'Envoi…' : 'Renvoyer l’e-mail'}
        </button>
        <button type="button" className="text-zinc-500 text-sm hover:text-zinc-300 w-full" onClick={handleLogout}>
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
