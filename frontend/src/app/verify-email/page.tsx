'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';
import AuthLayout from '@/components/AuthLayout';
import { getFirebaseAuth, isFirebaseConfigured } from '@/lib/firebase/client';
import { sendVerificationCode, confirmVerificationCode } from '@/lib/client/verification';
import { formatAuthError } from '@/lib/firebase/errors';

export default function VerifyEmailPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
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
      sendVerificationCode()
        .then(() => setMsg('Un code à 6 chiffres a été envoyé à votre adresse e-mail.'))
        .catch((err) => setError(formatAuthError(err)))
        .finally(() => setSending(false));
    }
  }, [router]);

  async function handleResend() {
    setError('');
    setMsg('');
    setSending(true);
    try {
      await sendVerificationCode();
      setMsg('Nouveau code envoyé. Vérifiez votre boîte mail (et les spams).');
    } catch (err) {
      setError(formatAuthError(err));
    } finally {
      setSending(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setMsg('');
    setLoading(true);
    try {
      await confirmVerificationCode(code);
      const user = getFirebaseAuth().currentUser;
      if (user) await user.reload();
      setMsg('Compte vérifié ! Redirection…');
      router.replace('/dashboard');
    } catch (err) {
      setError(formatAuthError(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    await signOut(getFirebaseAuth());
    router.push('/login');
  }

  return (
    <AuthLayout
      title="Vérifiez votre e-mail"
      subtitle="Entrez le code à 6 chiffres reçu par e-mail"
    >
      <div className="space-y-2 text-sm text-zinc-400">
        <p>
          Code envoyé à <strong className="text-white">{email || 'votre adresse'}</strong>
          {sending && <span className="text-indigo-400"> — envoi…</span>}
        </p>
        <p className="text-xs text-zinc-500">Valable 15 minutes. Pensez aux courriers indésirables.</p>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label className="label">Code de vérification</label>
          <input
            className="input text-center text-2xl tracking-[0.4em] font-mono"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="000000"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            required
          />
        </div>

        {msg && <p className="text-emerald-400 text-sm">{msg}</p>}
        {error && <p className="text-red-400 text-sm whitespace-pre-line">{error}</p>}

        <button
          type="submit"
          className="btn-primary w-full py-3"
          disabled={loading || code.length !== 6}
        >
          {loading ? 'Vérification…' : 'Valider le code'}
        </button>
        <button
          type="button"
          className="btn-secondary w-full py-3"
          onClick={handleResend}
          disabled={sending}
        >
          {sending ? 'Envoi…' : 'Renvoyer le code'}
        </button>
        <button type="button" className="text-zinc-500 text-sm hover:text-zinc-300 w-full" onClick={handleLogout}>
          Utiliser un autre compte
        </button>
      </form>

      <p className="mt-6 text-sm text-zinc-500 text-center">
        <Link href="/login" className="text-indigo-400 hover:text-indigo-300 font-medium">
          Retour connexion
        </Link>
      </p>
    </AuthLayout>
  );
}
