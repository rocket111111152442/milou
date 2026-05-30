import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { verifyRequest } from '@/lib/firebase/auth-server';
import { getAdminDb } from '@/lib/firebase/admin';

async function getMissionIfParticipant(missionId: string, uid: string) {
  const snap = await getAdminDb().collection('missions').doc(missionId).get();
  if (!snap.exists) throw new Error('Mission introuvable');
  const data = snap.data()!;
  if (data.clientId !== uid && data.providerId !== uid) {
    throw new Error('Accès refusé à cette conversation');
  }
  if (data.status !== 'in_progress') {
    throw new Error('La mission est terminée, le chat est fermé');
  }
  return data;
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { uid } = await verifyRequest(req);
    await getMissionIfParticipant(params.id, uid);

    const snap = await getAdminDb()
      .collection('missions')
      .doc(params.id)
      .collection('messages')
      .orderBy('createdAt', 'asc')
      .limit(200)
      .get();

    const messages = snap.docs.map((d) => {
      const data = d.data();
      return {
        _id: d.id,
        senderId: data.senderId,
        senderName: data.senderName || '',
        text: data.text,
        createdAt: data.createdAt?.toDate?.()?.toISOString?.() || '',
      };
    });

    return NextResponse.json({ messages });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erreur';
    const status = msg.includes('Accès') ? 403 : msg.includes('introuvable') ? 404 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { uid } = await verifyRequest(req);
    await getMissionIfParticipant(params.id, uid);

    const { text } = await req.json();
    const trimmed = String(text || '').trim();
    if (!trimmed || trimmed.length > 2000) {
      return NextResponse.json({ error: 'Message invalide (max 2000 caractères)' }, { status: 400 });
    }

    const userSnap = await getAdminDb().collection('users').doc(uid).get();
    const u = userSnap.data();
    const senderName = u ? `${u.firstname} ${u.lastname}`.trim() : 'Utilisateur';

    const ref = await getAdminDb()
      .collection('missions')
      .doc(params.id)
      .collection('messages')
      .add({
        senderId: uid,
        senderName,
        text: trimmed,
        createdAt: FieldValue.serverTimestamp(),
      });

    return NextResponse.json({
      message: {
        _id: ref.id,
        senderId: uid,
        senderName,
        text: trimmed,
        createdAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erreur';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
