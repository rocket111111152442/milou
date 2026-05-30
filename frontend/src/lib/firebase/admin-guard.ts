import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { verifyRequest } from '@/lib/firebase/auth-server';
import { getAdminDb } from '@/lib/firebase/admin';

export async function requireAdmin(req: NextRequest): Promise<string> {
  const { uid } = await verifyRequest(req);
  const snap = await getAdminDb().collection('users').doc(uid).get();
  const role = snap.data()?.role;
  if (role !== 'admin' && role !== 'moderator') {
    throw new Error('Accès modérateur requis');
  }
  return uid;
}

export function adminError(err: unknown) {
  const message = err instanceof Error ? err.message : 'Erreur';
  const status = message.includes('modérateur') || message.includes('admin') ? 403 : 401;
  return NextResponse.json({ error: message }, { status });
}

export async function logAdminAction(
  adminId: string,
  action: string,
  target: { type: string; id: string },
  details?: Record<string, unknown>
) {
  await getAdminDb().collection('admin_audit').add({
    adminId,
    action,
    targetType: target.type,
    targetId: target.id,
    details: details ?? {},
    createdAt: FieldValue.serverTimestamp(),
  });
}
