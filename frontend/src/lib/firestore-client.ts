import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  addDoc,
  getDoc,
  doc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { getFirebaseDb } from '@/lib/firebase/client';
import { Listing, Transaction, Mission } from '@/lib/types';

function mapListing(id: string, data: Record<string, unknown>, author?: Record<string, unknown>): Listing {
  return {
    _id: id,
    userId: author
      ? {
          firstname: String(author.firstname || ''),
          lastname: String(author.lastname || ''),
          email: String(author.email || ''),
          reputation: Number(author.reputation || 0),
        }
      : (data.userId as Listing['userId']),
    title: String(data.title),
    description: String(data.description),
    category: String(data.category),
    price: Number(data.price),
    type: data.type as Listing['type'],
    tags: (data.tags as string[]) || [],
    estimatedDelay: String(data.estimatedDelay || ''),
    status: String(data.status),
    createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : String(data.createdAt),
  };
}

export async function fetchListings(category?: string, typeFilter?: string): Promise<Listing[]> {
  const db = getFirebaseDb();
  const snap = await getDocs(query(collection(db, 'listings'), limit(100)));

  const listings: Listing[] = [];
  for (const d of snap.docs) {
    const data = d.data();
    if (!['open', 'in_progress'].includes(String(data.status))) continue;
    if (category && category !== 'Tous' && data.category !== category) continue;
    if (typeFilter && data.type !== typeFilter) continue;
    let author: Record<string, unknown> | undefined;
    try {
      const authorSnap = await getDoc(doc(db, 'users', data.userId as string));
      author = authorSnap.exists() ? authorSnap.data() : undefined;
    } catch {
      author = { firstname: 'Utilisateur', lastname: '', email: '', reputation: 0 };
    }
    listings.push(mapListing(d.id, data, author));
  }
  return listings;
}

export async function fetchMyListings(userId: string): Promise<Listing[]> {
  const db = getFirebaseDb();
  const q = query(collection(db, 'listings'), where('userId', '==', userId), limit(50));
  const snap = await getDocs(q);
  return snap.docs.map((d) => mapListing(d.id, d.data()));
}

export async function fetchMyTransactions(userId: string): Promise<Transaction[]> {
  const db = getFirebaseDb();
  const fromQ = query(
    collection(db, 'transactions'),
    where('fromUserId', '==', userId),
    limit(50)
  );
  const toQ = query(collection(db, 'transactions'), where('toUserId', '==', userId), limit(50));
  const [fromSnap, toSnap] = await Promise.all([getDocs(fromQ), getDocs(toQ)]);

  const map = new Map<string, Transaction>();
  const add = (d: { id: string; data: () => Record<string, unknown> }) => {
    const data = d.data();
    map.set(d.id, {
      _id: d.id,
      fromUserId: data.fromUserId ? { firstname: '', lastname: '', email: '' } : null,
      toUserId: data.toUserId ? { firstname: '', lastname: '', email: '' } : null,
      amount: Number(data.amount),
      type: String(data.type),
      description: String(data.description || ''),
      createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : '',
    });
  };
  fromSnap.docs.forEach(add);
  toSnap.docs.forEach(add);
  return Array.from(map.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export async function fetchMyMissions(userId: string): Promise<Mission[]> {
  const db = getFirebaseDb();
  const clientQ = query(
    collection(db, 'missions'),
    where('clientId', '==', userId),
    where('status', '==', 'in_progress')
  );
  const providerQ = query(
    collection(db, 'missions'),
    where('providerId', '==', userId),
    where('status', '==', 'in_progress')
  );
  const [cSnap, pSnap] = await Promise.all([getDocs(clientQ), getDocs(providerQ)]);
  const ids = new Set<string>();
  const missions: Mission[] = [];

  for (const d of [...cSnap.docs, ...pSnap.docs]) {
    if (ids.has(d.id)) continue;
    ids.add(d.id);
    const data = d.data();
    const listingSnap = await getDoc(doc(db, 'listings', data.listingId as string));
    const clientSnap = await getDoc(doc(db, 'users', data.clientId as string));
    const providerSnap = await getDoc(doc(db, 'users', data.providerId as string));
    missions.push({
      _id: d.id,
      listingId: listingSnap.exists()
        ? mapListing(listingSnap.id, listingSnap.data())
        : ({} as Listing),
      clientId: {
        firstname: String(clientSnap.data()?.firstname || ''),
        lastname: String(clientSnap.data()?.lastname || ''),
        email: String(clientSnap.data()?.email || ''),
      },
      providerId: {
        firstname: String(providerSnap.data()?.firstname || ''),
        lastname: String(providerSnap.data()?.lastname || ''),
        email: String(providerSnap.data()?.email || ''),
      },
      amount: Number(data.amount),
      status: String(data.status),
      createdAt: '',
    });
  }
  return missions;
}

export async function createListing(
  userId: string,
  data: {
    title: string;
    description: string;
    category: string;
    price: number;
    type: 'offer' | 'request';
    tags: string[];
    estimatedDelay: string;
  }
) {
  const db = getFirebaseDb();
  await addDoc(collection(db, 'listings'), {
    userId,
    ...data,
    status: 'open',
    createdAt: serverTimestamp(),
  });
}
