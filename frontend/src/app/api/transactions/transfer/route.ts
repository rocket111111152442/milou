import { NextRequest, NextResponse } from 'next/server';
import { verifyRequest } from '@/lib/firebase/auth-server';
import { getAdminDb } from '@/lib/firebase/admin';
import { transferMilou, userToJson } from '@/lib/firebase/wallet';

export async function POST(req: NextRequest) {
  try {
    const { uid } = await verifyRequest(req);
    const { recipientEmail, amount } = await req.json();
    const num = Number(amount);
    if (!recipientEmail || num <= 0) {
      return NextResponse.json({ error: 'Données invalides' }, { status: 400 });
    }

    const db = getAdminDb();
    const me = await db.collection('users').doc(uid).get();
    if (me.data()?.email === recipientEmail.toLowerCase()) {
      return NextResponse.json({ error: 'Impossible de transférer à soi-même' }, { status: 400 });
    }

    const q = await db.collection('users').where('email', '==', recipientEmail.toLowerCase()).limit(1).get();
    if (q.empty) return NextResponse.json({ error: 'Destinataire introuvable' }, { status: 404 });

    await transferMilou(db, {
      fromUserId: uid,
      toUserId: q.docs[0].id,
      amount: Math.round(num * 100) / 100,
      type: 'transfer',
      description: `Transfert vers ${recipientEmail}`,
    });

    const updated = await db.collection('users').doc(uid).get();
    return NextResponse.json({ balance: updated.data()?.balance });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur' },
      { status: 400 }
    );
  }
}
