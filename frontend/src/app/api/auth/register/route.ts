import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebase/admin';
import { recordTransaction } from '@/lib/firebase/wallet';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(req: NextRequest) {
  try {
    const { firstname, lastname, email, password } = await req.json();
    if (!firstname || !lastname || !email || !password || password.length < 6) {
      return NextResponse.json({ error: 'Données invalides' }, { status: 400 });
    }

    const auth = getAdminAuth();
    const db = getAdminDb();

    const existing = await db.collection('users').where('email', '==', email.toLowerCase()).limit(1).get();
    if (!existing.empty) {
      return NextResponse.json({ error: 'Email déjà utilisé' }, { status: 409 });
    }

    const userRecord = await auth.createUser({
      email: email.toLowerCase(),
      password,
      displayName: `${firstname} ${lastname}`,
    });

    await db.collection('users').doc(userRecord.uid).set({
      firstname,
      lastname,
      email: email.toLowerCase(),
      balance: 10,
      role: 'user',
      reputation: 0,
      totalEarned: 10,
      totalSpent: 0,
      transactionCount: 1,
      createdAt: FieldValue.serverTimestamp(),
    });

    await recordTransaction(db, {
      fromUserId: null,
      toUserId: userRecord.uid,
      amount: 10,
      type: 'registration',
      description: 'Bonus de bienvenue',
    });

    const user = {
      id: userRecord.uid,
      firstname,
      lastname,
      email: email.toLowerCase(),
      balance: 10,
      role: 'user',
      reputation: 0,
      totalEarned: 10,
      totalSpent: 0,
      transactionCount: 1,
      createdAt: new Date().toISOString(),
    };

    return NextResponse.json({ user });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erreur';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
