import { NextRequest, NextResponse } from 'next/server';
import { verifyRequest } from '@/lib/firebase/auth-server';
import { getAdminDb } from '@/lib/firebase/admin';
import { releaseEscrow } from '@/lib/firebase/wallet';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { uid } = await verifyRequest(req);
    const db = getAdminDb();
    const missionRef = db.collection('missions').doc(params.id);
    const missionSnap = await missionRef.get();

    if (!missionSnap.exists) {
      return NextResponse.json({ error: 'Mission introuvable' }, { status: 404 });
    }
    const mission = missionSnap.data()!;

    if (mission.status !== 'in_progress') {
      return NextResponse.json({ error: 'Mission déjà terminée' }, { status: 400 });
    }
    if (mission.clientId !== uid) {
      return NextResponse.json({ error: 'Seul le client peut valider' }, { status: 403 });
    }

    await releaseEscrow(db, mission.providerId, mission.amount, mission.listingId, params.id);
    await missionRef.update({ status: 'completed', escrowHeld: false });
    await db.collection('listings').doc(mission.listingId).update({ status: 'closed' });

    return NextResponse.json({ message: 'Mission validée' });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur' },
      { status: 400 }
    );
  }
}
