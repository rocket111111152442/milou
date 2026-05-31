import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebase/admin';
import { recordTransaction } from '@/lib/firebase/wallet';
import { FieldValue } from 'firebase-admin/firestore';
import { normalizePostalCode } from '@/lib/email';

export async function POST(req: NextRequest) {
  try {
    const { firstname, lastname, email, password, postalCode } = await req.json();
    const normalizedPostalCode = normalizePostalCode(postalCode);
    if (!firstname || !lastname || !email || !password || password.length < 6 || !normalizedPostalCode) {
      return NextResponse.json({ error: 'Données invalides' }, { status: 400 });
    }

    const auth = getAdminAuth();
    const db = getAdminDb();

    const emailNorm = email.toLowerCase();

    try {
      await auth.getUserByEmail(emailNorm);
      return NextResponse.json(
        { error: 'Cet e-mail est déjà utilisé. Allez sur Connexion.' },
        { status: 409 }
      );
    } catch (e: unknown) {
      const code = e && typeof e === 'object' && 'code' in e ? String((e as { code: string }).code) : '';
      if (code !== 'auth/user-not-found') {
        throw e;
      }
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
      postalCode: normalizedPostalCode,
      balance: 10,
      role: 'user',
      status: 'active',
      isPremium: false,
      premiumExpiresAt: null,
      reputation: 0,
      reviewCount: 0,
      averageRating: 0,
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
      status: 'active',
      reputation: 0,
      totalEarned: 10,
      totalSpent: 0,
      transactionCount: 1,
      createdAt: new Date().toISOString(),
    };

    return NextResponse.json({ user });
  } catch (err: unknown) {
    const code = err && typeof err === 'object' && 'code' in err ? String((err as { code: string }).code) : '';
    if (code === 'auth/email-already-exists') {
      return NextResponse.json(
        { error: 'Cet e-mail est déjà utilisé. Allez sur Connexion.' },
        { status: 409 }
      );
    }
    const msg = err instanceof Error ? err.message : 'Erreur serveur';
    if (msg.includes('DECODER') || msg.includes('private key')) {
      return NextResponse.json(
        { error: 'Clé Firebase Admin invalide dans .env.local (FIREBASE_PRIVATE_KEY).' },
        { status: 500 }
      );
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
