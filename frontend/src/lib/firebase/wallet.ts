import { FieldValue, Firestore } from 'firebase-admin/firestore';
import { isPremiumActive, premiumExpiresAtToDate } from '@/lib/premium';

type TxType =
  | 'registration'
  | 'transfer'
  | 'service_payment'
  | 'escrow_hold'
  | 'escrow_release'
  | 'admin_adjustment'
  | 'promo_code';

export async function recordTransaction(
  db: Firestore,
  data: {
    fromUserId: string | null;
    toUserId: string | null;
    amount: number;
    type: TxType;
    description?: string;
    listingId?: string | null;
    missionId?: string | null;
  }
) {
  const ref = await db.collection('transactions').add({
    ...data,
    createdAt: FieldValue.serverTimestamp(),
  });
  return ref.id;
}

export async function transferMilou(
  db: Firestore,
  opts: {
    fromUserId: string | null;
    toUserId: string | null;
    amount: number;
    type: TxType;
    description?: string;
    listingId?: string | null;
    missionId?: string | null;
  }
) {
  const { amount } = opts;
  if (amount <= 0) throw new Error('Le montant doit être positif');

  await db.runTransaction(async (tx) => {
    const fromRef = opts.fromUserId ? db.collection('users').doc(opts.fromUserId) : null;
    const toRef = opts.toUserId ? db.collection('users').doc(opts.toUserId) : null;

    const fromSnap = fromRef ? await tx.get(fromRef) : null;
    const toSnap = toRef ? await tx.get(toRef) : null;

    if (opts.fromUserId && (!fromSnap?.exists)) throw new Error('Émetteur introuvable');
    if (opts.toUserId && (!toSnap?.exists)) throw new Error('Destinataire introuvable');

    if (fromRef && fromSnap) {
      const balance = fromSnap.data()?.balance ?? 0;
      if (balance < amount) throw new Error('Solde insuffisant');
      tx.update(fromRef, {
        balance: balance - amount,
        totalSpent: FieldValue.increment(amount),
        transactionCount: FieldValue.increment(1),
      });
    }
    if (toRef && toSnap) {
      const balance = toSnap.data()?.balance ?? 0;
      tx.update(toRef, {
        balance: balance + amount,
        totalEarned: FieldValue.increment(amount),
        transactionCount: FieldValue.increment(1),
      });
    }

    const txRef = db.collection('transactions').doc();
    tx.set(txRef, {
      fromUserId: opts.fromUserId,
      toUserId: opts.toUserId,
      amount,
      type: opts.type,
      description: opts.description || '',
      listingId: opts.listingId || null,
      missionId: opts.missionId || null,
      createdAt: FieldValue.serverTimestamp(),
    });
  });
}

export async function holdEscrow(
  db: Firestore,
  clientId: string,
  amount: number,
  listingId: string,
  missionId: string
) {
  await transferMilou(db, {
    fromUserId: clientId,
    toUserId: null,
    amount,
    type: 'escrow_hold',
    description: 'Milou bloqués en escrow',
    listingId,
    missionId,
  });
}

export async function releaseEscrow(
  db: Firestore,
  providerId: string,
  amount: number,
  listingId: string,
  missionId: string
) {
  await db.runTransaction(async (tx) => {
    const providerRef = db.collection('users').doc(providerId);
    const providerSnap = await tx.get(providerRef);
    if (!providerSnap.exists) throw new Error('Prestataire introuvable');

    const balance = providerSnap.data()?.balance ?? 0;
    tx.update(providerRef, {
      balance: balance + amount,
      totalEarned: FieldValue.increment(amount),
      reputation: FieldValue.increment(1),
      transactionCount: FieldValue.increment(1),
    });

    const txRef = db.collection('transactions').doc();
    tx.set(txRef, {
      fromUserId: null,
      toUserId: providerId,
      amount,
      type: 'escrow_release',
      description: 'Paiement mission validée',
      listingId,
      missionId,
      createdAt: FieldValue.serverTimestamp(),
    });
  });
}

export function tsToIso(v: unknown): string {
  const t = v as { toDate?: () => Date } | undefined;
  return t?.toDate?.()?.toISOString?.() || new Date().toISOString();
}

export function userToJson(id: string, data: Record<string, unknown>) {
  const premiumActive = isPremiumActive(data);
  const exp = premiumExpiresAtToDate(data.premiumExpiresAt);
  return {
    id,
    firstname: String(data.firstname ?? ''),
    lastname: String(data.lastname ?? ''),
    email: String(data.email ?? ''),
    balance: Number(data.balance ?? 0),
    role: (data.role as string) ?? 'user',
    status: (data.status as string) ?? 'active',
    reputation: Number(data.reputation ?? 0),
    totalEarned: Number(data.totalEarned ?? 0),
    totalSpent: Number(data.totalSpent ?? 0),
    transactionCount: Number(data.transactionCount ?? 0),
    moderatorNotes: String(data.moderatorNotes ?? ''),
    isPremium: premiumActive,
    premiumExpiresAt: exp ? exp.toISOString() : null,
    lastSeenAt: data.lastSeenAt ? tsToIso(data.lastSeenAt) : null,
    isOnline: Boolean(data.isOnline),
    reviewCount: Number(data.reviewCount ?? 0),
    averageRating: Number(data.averageRating ?? 0),
    createdAt: tsToIso(data.createdAt),
    suspendedAt: data.suspendedAt ? tsToIso(data.suspendedAt) : null,
  };
}
