import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase/admin';
import { verifyRequest } from '@/lib/firebase/auth-server';
import { isPremiumActive } from '@/lib/premium';
import { assertCanCreateListing } from '@/lib/premium/usage';
import { syncPremiumStatus } from '@/lib/premium/sync';
import { jsonNoStore } from '@/lib/http';
import { isListingPublic, isListingVisible } from '@/lib/listings';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category');
    const typeFilter = searchParams.get('type');
    const q = searchParams.get('q')?.toLowerCase();

    const snap = await getAdminDb().collection('listings').limit(150).get();
    const listings: Array<Record<string, unknown> & { _sort: number }> = [];

    for (const d of snap.docs) {
      const data = d.data();
      if (!isListingVisible(data.status) || !isListingPublic(data.status)) continue;
      if (category && category !== 'Tous') {
        const cat = String(data.category || '');
        if (cat !== category && cat.toLowerCase() !== category.toLowerCase()) continue;
      }
      if (typeFilter && data.type !== typeFilter) continue;

      let author = {
        firstname: '',
        lastname: '',
        email: '',
        reputation: 0,
        isPremium: false,
        averageRating: 0,
      };
      let authorPremium = false;

      if (data.userId) {
        const userSnap = await getAdminDb().collection('users').doc(data.userId as string).get();
        if (userSnap.exists) {
          const u = userSnap.data()!;
          authorPremium = isPremiumActive(u);
          author = {
            firstname: String(u.firstname || ''),
            lastname: String(u.lastname || ''),
            email: String(u.email || ''),
            reputation: Number(u.reputation || 0),
            isPremium: authorPremium,
            averageRating: Number(u.averageRating || 0),
          };
        }
      }

      const title = String(data.title || '').toLowerCase();
      const desc = String(data.description || '').toLowerCase();
      if (q && !title.includes(q) && !desc.includes(q)) continue;

      const featured = Boolean(data.featured) || authorPremium;
      const created = data.createdAt?.toDate?.()?.getTime?.() || 0;
      const sortScore = (featured ? 1000 : 0) + (authorPremium ? 500 : 0) + created / 1e10;

      listings.push({
        _id: d.id,
        ...data,
        authorId: String(data.userId || ''),
        featured,
        userId: author,
        createdAt: data.createdAt?.toDate?.()?.toISOString?.() || '',
        _sort: sortScore,
      });
    }

    listings.sort((a, b) => (b._sort as number) - (a._sort as number));
    const result = listings.map(({ _sort, ...rest }) => rest);

    return jsonNoStore({ listings: result });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { uid } = await verifyRequest(req);
    const body = await req.json();
    const { title, description, category, price, type, tags, estimatedDelay, missionType } = body;

    if (!title || !description || !category || !price || !type) {
      return NextResponse.json({ error: 'Données invalides' }, { status: 400 });
    }

    const db = getAdminDb();
    const userData = await syncPremiumStatus(db, uid);
    await assertCanCreateListing(db, uid, userData);

    const premium = isPremiumActive(userData);

    const ref = await db.collection('listings').add({
      userId: uid,
      title: String(title).trim(),
      description: String(description).trim(),
      category: String(category).trim(),
      price: Number(price),
      type,
      tags: Array.isArray(tags) ? tags : [],
      estimatedDelay: estimatedDelay || '',
      missionType: missionType || 'standard',
      featured: premium,
      status: 'open',
      createdAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ id: ref.id, featured: premium });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur' },
      { status: err instanceof Error && err.message.includes('Authentification') ? 401 : 400 }
    );
  }
}
