import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { verifyRequest } from '@/lib/firebase/auth-server';
import { getAdminDb } from '@/lib/firebase/admin';
import { assertCanCreateListing } from '@/lib/premium/usage';
import { syncPremiumStatus } from '@/lib/premium/sync';
import { isPremiumActive } from '@/lib/premium';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { uid } = await verifyRequest(req);
    const db = getAdminDb();
    const snap = await db.collection('listings').doc(params.id).get();
    if (!snap.exists) {
      return NextResponse.json({ error: 'Annonce introuvable' }, { status: 404 });
    }
    const src = snap.data()!;
    if (String(src.userId) !== uid) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });
    }

    const userData = await syncPremiumStatus(db, uid);
    await assertCanCreateListing(db, uid, userData);

    const body = await req.json().catch(() => ({}));
    const asDraft = body.publish === false;

    const ref = await db.collection('listings').add({
      userId: uid,
      title: `${String(src.title)} (copie)`,
      description: String(src.description || ''),
      category: String(src.category || ''),
      price: Number(src.price || 0),
      type: src.type === 'request' ? 'request' : 'offer',
      tags: Array.isArray(src.tags) ? src.tags : [],
      estimatedDelay: String(src.estimatedDelay || '7 jours'),
      missionType: String(src.missionType || 'standard'),
      isInPerson: Boolean(src.isInPerson),
      postalCode: src.postalCode || null,
      images: Array.isArray(src.images) ? src.images.slice(0, 5) : [],
      featured: isPremiumActive(userData),
      status: asDraft ? 'draft' : 'open',
      createdAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ id: ref.id, status: asDraft ? 'draft' : 'open' });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur' },
      { status: 400 }
    );
  }
}
