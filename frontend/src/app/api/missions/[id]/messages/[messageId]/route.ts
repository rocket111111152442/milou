import { NextRequest, NextResponse } from 'next/server';
import { verifyRequest } from '@/lib/firebase/auth-server';
import { getAdminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

async function canDeleteMessage(missionId: string, uid: string, messageSenderId: string) {
  const db = getAdminDb();
  const userSnap = await db.collection('users').doc(uid).get();
  const role = String(userSnap.data()?.role || 'user');
  if (role === 'admin' || role === 'moderator') return true;

  if (messageSenderId !== uid) return false;

  const missionSnap = await db.collection('missions').doc(missionId).get();
  if (!missionSnap.exists) return false;
  const m = missionSnap.data()!;
  return m.clientId === uid || m.providerId === uid;
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; messageId: string } }
) {
  try {
    const { uid } = await verifyRequest(req);
    const db = getAdminDb();
    const msgRef = db.collection('missions').doc(params.id).collection('messages').doc(params.messageId);
    const msgSnap = await msgRef.get();
    if (!msgSnap.exists) {
      return NextResponse.json({ error: 'Message introuvable' }, { status: 404 });
    }

    const senderId = String(msgSnap.data()?.senderId || '');
    if (senderId === 'system') {
      return NextResponse.json({ error: 'Impossible de supprimer un message système' }, { status: 400 });
    }

    const allowed = await canDeleteMessage(params.id, uid, senderId);
    if (!allowed) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });
    }

    await msgRef.delete();
    return NextResponse.json({ message: 'Message supprimé' });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur' },
      { status: err instanceof Error && err.message.includes('Authentification') ? 401 : 400 }
    );
  }
}
