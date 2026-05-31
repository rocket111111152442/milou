import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { verifyRequest } from '@/lib/firebase/auth-server';
import { getAdminDb } from '@/lib/firebase/admin';
import { validateChatFileBatch } from '@/lib/chat-attachments';
import { uploadChatAttachments } from '@/lib/firebase/storage-admin';
import { mapMessageDoc } from '@/lib/mission-messages';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function getMissionIfParticipant(missionId: string, uid: string) {
  const snap = await getAdminDb().collection('missions').doc(missionId).get();
  if (!snap.exists) throw new Error('Mission introuvable');
  const data = snap.data()!;
  if (data.clientId !== uid && data.providerId !== uid) {
    throw new Error('Accès refusé à cette conversation');
  }
  if (!['in_progress', 'disputed'].includes(String(data.status))) {
    throw new Error('La mission est terminée, le chat est fermé');
  }
  return data;
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { uid } = await verifyRequest(req);
    await getMissionIfParticipant(params.id, uid);

    const form = await req.formData();
    const text = String(form.get('text') || '').trim().slice(0, 2000);
    const fileEntries = form.getAll('files').filter((v): v is File => v instanceof File);

    if (!text && fileEntries.length === 0) {
      return NextResponse.json({ error: 'Message ou fichier requis' }, { status: 400 });
    }

    validateChatFileBatch(
      fileEntries.map((f) => ({
        name: f.name,
        type: f.type || 'application/octet-stream',
        size: f.size,
      }))
    );

    const db = getAdminDb();
    const userSnap = await db.collection('users').doc(uid).get();
    const u = userSnap.data();
    const senderName = u ? `${u.firstname} ${u.lastname}`.trim() : 'Utilisateur';

    const msgRef = db.collection('missions').doc(params.id).collection('messages').doc();

    const buffers = await Promise.all(
      fileEntries.map(async (f) => ({
        name: f.name,
        mimeType: f.type || 'application/octet-stream',
        size: f.size,
        buffer: Buffer.from(await f.arrayBuffer()),
      }))
    );

    const attachments = buffers.length
      ? await uploadChatAttachments(params.id, msgRef.id, buffers)
      : [];

    const displayText =
      text ||
      (attachments.length === 1
        ? `📎 ${attachments[0].name}`
        : `📎 ${attachments.length} fichiers`);

    await msgRef.set({
      senderId: uid,
      senderName,
      text: displayText,
      attachments,
      createdAt: FieldValue.serverTimestamp(),
    });

    const saved = await msgRef.get();
    const message = mapMessageDoc(msgRef.id, saved.data()!);

    return NextResponse.json({ message });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur' },
      { status: err instanceof Error && err.message.includes('Authentification') ? 401 : 400 }
    );
  }
}
