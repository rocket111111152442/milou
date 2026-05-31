import { NextRequest, NextResponse } from 'next/server';
import { QueryDocumentSnapshot } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase/admin';
import { verifyRequest } from '@/lib/firebase/auth-server';

export async function GET(req: NextRequest) {
  try {
    const { uid } = await verifyRequest(req);
    const db = getAdminDb();

    const [asClient, asProvider] = await Promise.all([
      db.collection('missions').where('clientId', '==', uid).where('status', '==', 'completed').limit(30).get(),
      db.collection('missions').where('providerId', '==', uid).where('status', '==', 'completed').limit(30).get(),
    ]);

    const missionIds = new Set<string>();
    const missions: Array<{
      missionId: string;
      listingTitle: string;
      toUserId: string;
      toUserName: string;
      role: 'client' | 'provider';
    }> = [];

    const addMission = async (doc: QueryDocumentSnapshot, role: 'client' | 'provider') => {
      if (missionIds.has(doc.id)) return;
      const m = doc.data();
      if (m.completedReason === 'deadline_missed') return;
      if (role === 'client' && m.clientReviewed) return;
      if (role === 'provider' && m.providerReviewed) return;

      const reviewSnap = await db
        .collection('reviews')
        .where('missionId', '==', doc.id)
        .where('fromUserId', '==', uid)
        .limit(1)
        .get();
      if (!reviewSnap.empty) return;

      missionIds.add(doc.id);
      const otherId = role === 'client' ? String(m.providerId) : String(m.clientId);
      const otherSnap = await db.collection('users').doc(otherId).get();
      const other = otherSnap.data();
      const listingSnap = await db.collection('listings').doc(String(m.listingId)).get();

      missions.push({
        missionId: doc.id,
        listingTitle: String(listingSnap.data()?.title || 'Mission'),
        toUserId: otherId,
        toUserName: other
          ? `${other.firstname || ''} ${other.lastname || ''}`.trim()
          : 'Partenaire',
        role,
      });
    };

    for (const doc of asClient.docs) await addMission(doc, 'client');
    for (const doc of asProvider.docs) await addMission(doc, 'provider');

    return NextResponse.json({ pending: missions });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur' },
      { status: 401 }
    );
  }
}
