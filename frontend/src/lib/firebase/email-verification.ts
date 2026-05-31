import { User, sendEmailVerification } from 'firebase/auth';

export function getEmailVerificationContinueUrl() {
  const base =
    typeof window !== 'undefined'
      ? window.location.origin
      : process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  return `${base.replace(/\/$/, '')}/login?verified=1`;
}

/** Envoi via Firebase (fonctionne pour tous les e-mails, sans domaine Resend). */
export async function sendVerificationEmail(user: User) {
  await sendEmailVerification(user, {
    url: getEmailVerificationContinueUrl(),
    handleCodeInApp: false,
  });
}
