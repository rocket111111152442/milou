import { FieldValue, Firestore } from 'firebase-admin/firestore';
import { isPremiumActive, premiumExpiresAtToDate } from './index';

/** Désactive Premium si la date d'expiration est passée */
export async function syncPremiumStatus(db: Firestore, uid: string): Promise<Record<string, unknown>> {
  const ref = db.collection('users').doc(uid);
  const snap = await ref.get();
  if (!snap.exists) return {};
  const data = snap.data()!;

  if (!data.isPremium) return data;

  const exp = premiumExpiresAtToDate(data.premiumExpiresAt);
  if (exp && exp.getTime() <= Date.now()) {
    await ref.update({
      isPremium: false,
      premiumExpiresAt: null,
    });
    const updated = await ref.get();
    return updated.data()!;
  }

  return data;
}

export async function activatePremium(
  db: Firestore,
  uid: string,
  expiresAt: Date,
  stripeCustomerId?: string,
  stripeSubscriptionId?: string
) {
  await db.collection('users').doc(uid).update({
    isPremium: true,
    premiumExpiresAt: expiresAt,
    ...(stripeCustomerId ? { stripeCustomerId } : {}),
    ...(stripeSubscriptionId ? { stripeSubscriptionId } : {}),
    premiumActivatedAt: FieldValue.serverTimestamp(),
  });
}

export async function deactivatePremium(db: Firestore, uid: string) {
  await db.collection('users').doc(uid).update({
    isPremium: false,
    premiumExpiresAt: null,
    stripeSubscriptionId: null,
    premiumGrantedByAdmin: false,
  });
}

/** Premium offert par un admin (gratuit, sans Stripe). */
export async function grantPremiumAdmin(db: Firestore, uid: string, months: number) {
  const expiresAt = new Date();
  expiresAt.setMonth(expiresAt.getMonth() + Math.max(1, months));

  await db.collection('users').doc(uid).update({
    isPremium: true,
    premiumExpiresAt: expiresAt,
    premiumGrantedByAdmin: true,
    premiumActivatedAt: FieldValue.serverTimestamp(),
  });

  const listings = await db.collection('listings').where('userId', '==', uid).get();
  const batch = db.batch();
  listings.docs.forEach((d) => {
    if (['open', 'in_progress'].includes(String(d.data().status))) {
      batch.update(d.ref, { featured: true });
    }
  });
  if (!listings.empty) await batch.commit();

  return expiresAt;
}
