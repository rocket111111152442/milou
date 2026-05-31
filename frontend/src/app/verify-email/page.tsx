'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';
import AuthLayout from '@/components/AuthLayout';
import { getFirebaseAuth, isFirebaseConfigured } from '@/lib/firebase/client';
import { sendVerificationEmail } from '@/lib/firebase/email-verification';
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

  async function deliverVerificationEmails() {
    const user = getFirebaseAuth().currentUser;
    if (!user) return;

    setSending(true);
    setError('');
    try {
      const data = await sendVerificationCode();
      await sendVerificationEmail(user).catch(() => {});

      if (data.resendCodeDelivered) {
        setMsg('Code envoyé par e-mail. Consultez votre boîte mail (et les spams).');
      } else {
        setMsg(
          'Un e-mail avec un lien de confirmation a été envoyé. Ouvrez-le, cliquez sur le lien, puis sur « J’ai validé mon e-mail ». Vous pouvez aussi saisir le code si vous l’avez reçu.'
        );
      }
    } catch (err) {
      try {
        await sendVerificationEmail(user);
        setMsg(
          'Un e-mail de vérification a été envoyé (lien Firebase). Cliquez sur le lien, puis sur « J’ai validé mon e-mail ».'
        );
      } catch (inner) {
        setError(formatAuthError(inner));
      }
    } finally {
      setSending(false);
    }
  }

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
      deliverVerificationEmails();
    }
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await confirmVerificationCode(code);
      const user = getFirebaseAuth().currentUser;
      if (user) await user.reload();
      router.replace('/dashboard');
    } catch (err) {
      setError(formatAuthError(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleValidatedLink() {
    setError('');
    setLoading(true);
    try {
      const auth = getFirebaseAuth();
      const user = auth.currentUser;
      if (!user) throw new Error('Session expirée.');
      await user.reload();
      if (auth.currentUser?.emailVerified) {
        router.replace('/dashboard');
      } else {
        setError('Pas encore validé. Ouvrez l’e-mail Firebase et cliquez sur le lien, puis réessayez.');
      }
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
    <AuthLayout title="Vérifiez votre e-mail" subtitle="Code à 6 chiffres ou lien de confirmation">
      <p className="text-sm text-zinc-400 mb-4">
        E-mail : <strong className="text-white">{email}</strong>
        {sending && <span className="text-indigo-400"> — envoi…</span>}
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Code à 6 chiffres</label>
          <input
            className="input text-center text-2xl tracking-[0.35em] font-mono"
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

        <button type="submit" className="btn-primary w-full py-3" disabled={loading || code.length !== 6}>
          {loading ? 'Vérification…' : 'Valider le code'}
        </button>
        <button
          type="button"
          className="btn-secondary w-full py-3"
          onClick={handleValidatedLink}
          disabled={loading}
        >
          J&apos;ai validé mon e-mail (lien)
        </button>
        <button type="button" className="btn-secondary w-full py-3" onClick={deliverVerificationEmails} disabled={sending}>
          {sending ? 'Envoi…' : 'Renvoyer'}
        </button>
      </form>

      <button type="button" className="text-zinc-500 text-sm hover:text-zinc-300 w-full mt-4" onClick={handleLogout}>
        Changer d&apos;e-mail
      </button>

      <p className="mt-6 text-sm text-zinc-500 text-center">
        <Link href="/login" className="text-indigo-400 hover:text-indigo-300 font-medium">
          Connexion
        </Link>
      </p>
    </AuthLayout>
  );
}
