import { NextRequest, NextResponse } from 'next/server';
import { verifyRequest } from '@/lib/firebase/auth-server';
import { getAdminDb } from '@/lib/firebase/admin';
import { transferMilou } from '@/lib/firebase/wallet';
import { createNotification } from '@/lib/notifications';
import { assertCanTransfer } from '@/lib/premium/usage';
import { syncPremiumStatus } from '@/lib/premium/sync';

export async function POST(req: NextRequest) {
  try {
    const { uid } = await verifyRequest(req);
    const { recipientEmail, amount, confirmEmail } = await req.json();
    const num = Math.round(Number(amount) * 100) / 100;
    if (!recipientEmail || num <= 0) {
      return NextResponse.json({ error: 'Données invalides' }, { status: 400 });
    }

    const emailNorm = recipientEmail.toLowerCase().trim();
    if (confirmEmail && confirmEmail.toLowerCase().trim() !== emailNorm) {
      return NextResponse.json({ error: 'La confirmation e-mail ne correspond pas' }, { status: 400 });
    }

    const db = getAdminDb();
    const userData = await syncPremiumStatus(db, uid);
    await assertCanTransfer(db, uid, userData, num);

    const me = await db.collection('users').doc(uid).get();
    if (me.data()?.email === emailNorm) {
      return NextResponse.json({ error: 'Impossible de transférer à soi-même' }, { status: 400 });
    }

    const q = await db.collection('users').where('email', '==', emailNorm).limit(1).get();
    if (q.empty) return NextResponse.json({ error: 'Destinataire introuvable' }, { status: 404 });

    const recipientId = q.docs[0].id;
    const senderName = `${me.data()?.firstname || ''} ${me.data()?.lastname || ''}`.trim();

    await transferMilou(db, {
      fromUserId: uid,
      toUserId: recipientId,
      amount: num,
      type: 'transfer',
      description: `Transfert vers ${emailNorm}`,
    });

    await Promise.all([
      createNotification(db, {
        userId: recipientId,
        type: 'transfer_received',
        title: 'Milou reçus',
        body: `${senderName || 'Un utilisateur'} vous a envoyé ${num} M`,
        link: '/dashboard',
      }),
      createNotification(db, {
        userId: uid,
        type: 'transfer_sent',
        title: 'Transfert envoyé',
        body: `${num} M envoyés à ${emailNorm}`,
        link: '/dashboard',
      }),
    ]);

    const updated = await db.collection('users').doc(uid).get();
    return NextResponse.json({ balance: updated.data()?.balance });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur' },
      { status: 400 }
    );
  }
}
