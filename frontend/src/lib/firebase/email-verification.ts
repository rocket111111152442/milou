import { User, sendEmailVerification } from 'firebase/auth';

export function getEmailVerificationContinueUrl() {
  const base =
    typeof window !== 'undefined'
      ? window.location.origin
      : process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  return `${base.replace(/\/$/, '')}/login?verified=1`;
}

/** Lien de vérification Firebase — fonctionne pour toutes les adresses e-mail. */
export async function sendVerificationEmail(user: User) {
  await sendEmailVerification(user, {
    url: getEmailVerificationContinueUrl(),
    handleCodeInApp: false,
  });
}
