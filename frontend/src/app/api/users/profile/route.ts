import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';
import { verifyRequest } from '@/lib/firebase/auth-server';
import { userToJson } from '@/lib/firebase/wallet';
import { computeReliabilityScore, getUserBadges } from '@/lib/user-trust';
import { UserRole } from '@/lib/types';

export async function PATCH(req: NextRequest) {
  try {
    const { uid } = await verifyRequest(req);
    const { bio, skills, avatarUrl } = await req.json();

    const updates: Record<string, unknown> = {};
    if (bio !== undefined) updates.bio = String(bio).slice(0, 500);
    if (skills !== undefined) {
      const list = Array.isArray(skills) ? skills : String(skills).split(',');
      updates.skills = list.map((s) => String(s).trim()).filter(Boolean).slice(0, 12);
    }
    if (avatarUrl !== undefined) updates.avatarUrl = String(avatarUrl).slice(0, 2000);

    if (!Object.keys(updates).length) {
      return NextResponse.json({ error: 'Rien à mettre à jour' }, { status: 400 });
    }

    const ref = getAdminDb().collection('users').doc(uid);
    await ref.update(updates);
    const snap = await ref.get();
    const user = userToJson(uid, snap.data()!);
    const reliabilityScore = computeReliabilityScore(user);
    const badges = getUserBadges({
      isPremium: user.isPremium,
      role: user.role as UserRole,
      transactionCount: user.transactionCount,
      reviewCount: user.reviewCount,
      createdAt: user.createdAt,
    });

    return NextResponse.json({ user: { ...user, reliabilityScore, badges } });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur' },
      { status: 400 }
    );
  }
}
