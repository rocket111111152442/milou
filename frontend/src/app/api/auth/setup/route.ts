import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { verifyRequest } from '@/lib/firebase/auth-server';
import { getAdminDb } from '@/lib/firebase/admin';
import { recordTransaction, userToJson } from '@/lib/firebase/wallet';
import { normalizePostalCode } from '@/lib/email';

/** Crée le profil Firestore + bonus 10 Milou après inscription Firebase côté client */
export async function POST(req: NextRequest) {
  try {
    const { uid, email } = await verifyRequest(req, { allowUnverifiedEmail: true });
    const { firstname, lastname, postalCode } = await req.json();
    const normalizedPostalCode = normalizePostalCode(postalCode);

    if (!firstname?.trim() || !lastname?.trim() || !normalizedPostalCode) {
      return NextResponse.json({ error: 'Prénom, nom et code postal requis' }, { status: 400 });
    }

    const db = getAdminDb();
    const userRef = db.collection('users').doc(uid);
    const existing = await userRef.get();

    if (existing.exists) {
      return NextResponse.json({ user: userToJson(uid, existing.data()!) });
    }

    await userRef.set({
      firstname: firstname.trim(),
      lastname: lastname.trim(),
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
      toUserId: uid,
      amount: 10,
      type: 'registration',
      description: 'Bonus de bienvenue',
    });

    const snap = await userRef.get();
    return NextResponse.json({ user: userToJson(uid, snap.data()!) });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erreur serveur';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
