import { NextRequest } from 'next/server';
import { getAdminAuth } from './admin';

export async function verifyRequest(req: NextRequest) {
  const header = req.headers.get('authorization');
  if (!header?.startsWith('Bearer ')) {
    throw new Error('Authentification requise');
  }
  const token = header.slice(7);
  const decoded = await getAdminAuth().verifyIdToken(token);
  return { uid: decoded.uid, email: decoded.email || '' };
}
