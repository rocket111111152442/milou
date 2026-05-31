import { getFirebaseAuth } from '@/lib/firebase/client';

async function authPost(path: string, body?: object) {
  const user = getFirebaseAuth().currentUser;
  if (!user) throw new Error('Session expirée. Reconnectez-vous.');
  const token = await user.getIdToken();
  const res = await fetch(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Erreur');
  return data;
}

export function sendVerificationCode(): Promise<{
  message: string;
  expiresInMinutes: number;
  resendCodeDelivered?: boolean;
  linkDelivered?: boolean;
}> {
  return authPost('/api/auth/verification/send');
}

export function confirmVerificationCode(code: string) {
  return authPost('/api/auth/verification/confirm', { code });
}
