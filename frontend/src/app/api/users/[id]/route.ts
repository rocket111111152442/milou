import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';
import { getUserBadges, publicUserFields } from '@/lib/user-trust';
import { tsToIso } from '@/lib/firebase/wallet';
import { isPremiumActive } from '@/lib/premium';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const snap = await getAdminDb().collection('users').doc(params.id).get();
    if (!snap.exists) {
      return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 });
    }
    const data = snap.data()!;
    if (data.status === 'banned') {
      return NextResponse.json({ error: 'Profil indisponible' }, { status: 404 });
    }

    const publicData = publicUserFields(snap.id, {
      ...data,
      isPremium: isPremiumActive(data),
    });
    const createdAt = data.createdAt ? tsToIso(data.createdAt) : '';

    const openListingsSnap = await getAdminDb()
      .collection('listings')
      .where('userId', '==', params.id)
      .where('status', '==', 'open')
      .limit(6)
      .get();

    const listings = openListingsSnap.docs.map((d) => ({
      _id: d.id,
      title: d.data().title,
      price: d.data().price,
      type: d.data().type,
      category: d.data().category,
      images: d.data().images || [],
      status: d.data().status,
      createdAt: d.data().createdAt?.toDate?.()?.toISOString?.() || '',
    }));

    return NextResponse.json({
      user: {
        ...publicData,
        createdAt,
        badges: getUserBadges({
          isPremium: publicData.isPremium,
          role: publicData.role as 'user' | 'admin' | 'moderator',
          transactionCount: publicData.transactionCount,
          reviewCount: publicData.reviewCount,
          createdAt,
        }),
      },
      listings,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur' },
      { status: 500 }
    );
  }
}
