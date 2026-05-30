import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase/admin';
import { verifyRequest } from '@/lib/firebase/auth-server';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category');
    const typeFilter = searchParams.get('type');

    const snap = await getAdminDb().collection('listings').limit(100).get();
    const listings = [];

    for (const d of snap.docs) {
      const data = d.data();
      if (!['open', 'in_progress'].includes(String(data.status))) continue;
      if (category && category !== 'Tous' && data.category !== category) continue;
      if (typeFilter && data.type !== typeFilter) continue;

      let author = { firstname: '', lastname: '', email: '', reputation: 0 };
      if (data.userId) {
        const userSnap = await getAdminDb().collection('users').doc(data.userId as string).get();
        if (userSnap.exists) {
          const u = userSnap.data()!;
          author = {
            firstname: String(u.firstname || ''),
            lastname: String(u.lastname || ''),
            email: String(u.email || ''),
            reputation: Number(u.reputation || 0),
          };
        }
      }

      listings.push({
        _id: d.id,
        ...data,
        userId: author,
        createdAt: data.createdAt?.toDate?.()?.toISOString?.() || '',
      });
    }

    return NextResponse.json({ listings });
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
    const { title, description, category, price, type, tags, estimatedDelay } = body;

    if (!title || !description || !category || !price || !type) {
      return NextResponse.json({ error: 'Données invalides' }, { status: 400 });
    }

    const ref = await getAdminDb().collection('listings').add({
      userId: uid,
      title: String(title).trim(),
      description: String(description).trim(),
      category: String(category).trim(),
      price: Number(price),
      type,
      tags: Array.isArray(tags) ? tags : [],
      estimatedDelay: estimatedDelay || '',
      status: 'open',
      createdAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ id: ref.id });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur' },
      { status: err instanceof Error && err.message.includes('Authentification') ? 401 : 500 }
    );
  }
}
