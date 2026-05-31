import { NextRequest } from 'next/server';
import { getAdminAuth } from './admin';

export async function verifyRequest(
  req: NextRequest,
  opts?: { allowUnverifiedEmail?: boolean }
) {
  const header = req.headers.get('authorization');
  if (!header?.startsWith('Bearer ')) {
    throw new Error('Authentification requise');
  }
  const token = header.slice(7);
  const decoded = await getAdminAuth().verifyIdToken(token);
  if (!opts?.allowUnverifiedEmail && decoded.email_verified === false) {
    throw new Error('Vérifiez votre adresse e-mail avant de continuer');
  }
  return {
    uid: decoded.uid,
    email: decoded.email || '',
    emailVerified: decoded.email_verified === true,
  };
}
