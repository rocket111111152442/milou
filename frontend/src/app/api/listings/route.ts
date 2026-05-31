import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase/admin';
import { verifyRequest } from '@/lib/firebase/auth-server';
import { isPremiumActive } from '@/lib/premium';
import { assertCanCreateListing } from '@/lib/premium/usage';
import { syncPremiumStatus } from '@/lib/premium/sync';
import { jsonNoStore } from '@/lib/http';
import { isListingPublic, isListingVisible } from '@/lib/listings';
import { normalizePostalCode } from '@/lib/postal-code';
import { notifyUsersOnNewListing } from '@/lib/listing-notifications';
import { expireOldOpenListings } from '@/lib/listing-expiry';
import { normalizePostalCode } from '@/lib/postal-code';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category');
    const typeFilter = searchParams.get('type');
    const q = searchParams.get('q')?.toLowerCase();
    const nearMe = searchParams.get('nearMe') === '1';
    const postalFilter = normalizePostalCode(searchParams.get('postalCode') || '');
    const viewerPostal = normalizePostalCode(searchParams.get('viewerPostal') || '');

    const db = getAdminDb();
    await expireOldOpenListings(db).catch(() => {});

    const snap = await db.collection('listings').limit(150).get();
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
        role: 'user',
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
            role: String(u.role || 'user'),
            averageRating: Number(u.averageRating || 0),
          };
        }
      }

      const title = String(data.title || '').toLowerCase();
      const desc = String(data.description || '').toLowerCase();
      if (q && !title.includes(q) && !desc.includes(q)) continue;

      const listingPostal = normalizePostalCode(data.postalCode);
      if (postalFilter && listingPostal !== postalFilter) continue;
      if (nearMe && viewerPostal) {
        if (!listingPostal || listingPostal !== viewerPostal) continue;
      }

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
    const {
      title,
      description,
      category,
      price,
      type,
      tags,
      estimatedDelay,
      missionType,
      isInPerson,
      postalCode,
      images,
      publish,
    } = body;
    const listingPrice = Number(price);
    const listingType = type === 'request' ? 'request' : 'offer';
    const inPerson = Boolean(isInPerson);
    const normalizedPostal = inPerson ? normalizePostalCode(postalCode) : '';

    const asDraft = publish === false;
    if (!title || !description || !category || !listingPrice || !type) {
      return NextResponse.json({ error: 'Données invalides' }, { status: 400 });
    }
    if (inPerson && !normalizedPostal) {
      return NextResponse.json(
        { error: 'Indiquez un code postal pour une mission en présentiel.' },
        { status: 400 }
      );
    }

    const db = getAdminDb();
    const userData = await syncPremiumStatus(db, uid);
    await assertCanCreateListing(db, uid, userData);

    const balance = Number(userData.balance || 0);
    if (!asDraft && listingType === 'request' && listingPrice > balance) {
      return NextResponse.json(
        { error: `Solde insuffisant : il vous faut ${listingPrice} M pour publier cette demande (vous paierez le prestataire).` },
        { status: 400 }
      );
    }

    const premium = isPremiumActive(userData);
    const imageUrls = Array.isArray(images)
      ? images.map(String).filter(Boolean).slice(0, 5)
      : [];

    const listingData = {
      userId: uid,
      title: String(title).trim(),
      description: String(description).trim(),
      category: String(category).trim(),
      price: listingPrice,
      type: listingType,
      tags: Array.isArray(tags) ? tags : [],
      estimatedDelay: String(estimatedDelay || '').trim() || '5 minutes',
      missionType: missionType || 'standard',
      isInPerson: inPerson,
      postalCode: normalizedPostal || null,
      featured: premium,
      images: imageUrls,
      status: asDraft ? 'draft' : 'open',
      createdAt: FieldValue.serverTimestamp(),
    };

    const ref = await db.collection('listings').add(listingData);

    if (asDraft) {
      return NextResponse.json({ id: ref.id, featured: premium, draft: true });
    }

    const notifyResult = await notifyUsersOnNewListing(db, {
      listingId: ref.id,
      title: listingData.title,
      description: listingData.description,
      price: listingPrice,
      type: listingType,
      category: listingData.category,
      authorId: uid,
      isInPerson: inPerson,
      postalCode: normalizedPostal || undefined,
    });

    return NextResponse.json({
      id: ref.id,
      featured: premium,
      notify: notifyResult,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur' },
      { status: err instanceof Error && err.message.includes('Authentification') ? 401 : 400 }
    );
  }
}
