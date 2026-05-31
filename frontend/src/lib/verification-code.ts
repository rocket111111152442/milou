import { FieldValue, Firestore, Timestamp } from 'firebase-admin/firestore';
import { sendEmail } from '@/lib/email-server';

const CODE_TTL_MS = 15 * 60 * 1000;
const MIN_RESEND_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;

function generateSixDigitCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function issueVerificationCode(db: Firestore, uid: string, email: string) {
  const ref = db.collection('emailVerificationCodes').doc(uid);
  const snap = await ref.get();

  if (snap.exists) {
    const lastSent = snap.data()?.lastSentAt?.toDate?.()?.getTime?.() ?? 0;
    if (Date.now() - lastSent < MIN_RESEND_MS) {
      throw new Error('Attendez 1 minute avant de redemander un code.');
    }
  }

  const code = generateSixDigitCode();

  const sent = await sendEmail({
    to: email,
    subject: 'Votre code MILOU',
    text: [
      'Bonjour,',
      '',
      `Votre code de vérification MILOU est : ${code}`,
      '',
      'Saisissez ce code sur le site pour activer votre compte.',
      'Le code expire dans 15 minutes.',
      '',
      'Si vous n’avez pas demandé ce code, ignorez cet e-mail.',
    ].join('\n'),
  });

  if (!sent.ok) {
    throw new Error(sent.reason);
  }

  await ref.set({
    code,
    email: email.toLowerCase(),
    attempts: 0,
    lastSentAt: FieldValue.serverTimestamp(),
    expiresAt: Timestamp.fromDate(new Date(Date.now() + CODE_TTL_MS)),
  });

  return { expiresInMinutes: 15 };
}

export async function confirmVerificationCode(db: Firestore, uid: string, codeInput: string) {
  const ref = db.collection('emailVerificationCodes').doc(uid);
  const snap = await ref.get();

  if (!snap.exists) {
    throw new Error('Aucun code actif. Cliquez sur « Renvoyer le code ».');
  }

  const data = snap.data()!;
  const attempts = Number(data.attempts || 0) + 1;

  if (attempts > MAX_ATTEMPTS) {
    await ref.delete();
    throw new Error('Trop de tentatives. Demandez un nouveau code.');
  }

  const expires = data.expiresAt?.toDate?.() ?? new Date(0);
  if (expires.getTime() < Date.now()) {
    await ref.delete();
    throw new Error('Code expiré. Demandez un nouveau code.');
  }

  const normalized = String(codeInput).replace(/\D/g, '').trim();
  if (normalized.length !== 6 || normalized !== String(data.code)) {
    await ref.update({ attempts });
    throw new Error('Code incorrect.');
  }

  await ref.delete();
  return true;
}
