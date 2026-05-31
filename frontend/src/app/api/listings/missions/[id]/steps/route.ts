import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { verifyRequest } from '@/lib/firebase/auth-server';
import { getAdminDb } from '@/lib/firebase/admin';
import { MissionStep } from '@/lib/mission-steps';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { uid } = await verifyRequest(req);
    const { stepId, done } = await req.json();
    const db = getAdminDb();
    const ref = db.collection('missions').doc(params.id);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: 'Mission introuvable' }, { status: 404 });
    }
    const m = snap.data()!;
    if (m.status !== 'in_progress') {
      return NextResponse.json({ error: 'Mission non active' }, { status: 400 });
    }
    if (m.clientId !== uid && m.providerId !== uid) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });
    }

    const steps = (m.steps as MissionStep[]) || [];
    const idx = steps.findIndex((s) => s.id === stepId);
    if (idx === -1) {
      return NextResponse.json({ error: 'Étape introuvable' }, { status: 404 });
    }

    const isProvider = m.providerId === uid;
    if (stepId === 'validate' && isProvider) {
      return NextResponse.json({ error: 'Seul le client peut valider' }, { status: 403 });
    }
    if (stepId !== 'validate' && !isProvider && m.clientId === uid) {
      return NextResponse.json({ error: 'Le prestataire gère cette étape' }, { status: 403 });
    }

    steps[idx] = {
      ...steps[idx],
      done: Boolean(done),
      doneAt: done ? new Date().toISOString() : null,
    };

    const updates: Record<string, unknown> = { steps };
    if (stepId === 'deliver' && done) {
      updates.deliveredAt = FieldValue.serverTimestamp();
    }

    await ref.update(updates);
    return NextResponse.json({ steps });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur' },
      { status: 400 }
    );
  }
}
