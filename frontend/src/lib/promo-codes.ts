import { FieldValue, Firestore, Timestamp } from 'firebase-admin/firestore';
import { transferMilou } from '@/lib/firebase/wallet';
import { grantPremiumByDays } from '@/lib/premium/sync';
import { createNotification } from '@/lib/notifications';

export function normalizePromoCode(raw: string): string {
  return String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, '');
}

export interface PromoCodeData {
  code: string;
  label?: string;
  milouAmount: number;
  premiumDays: number;
  reputationBonus: number;
  maxUses: number;
  maxUsesPerUser: number;
  minAccountAgeDays: number;
  expiresAt: Timestamp | null;
  active: boolean;
  usedCount: number;
  createdBy?: string;
  createdAt?: { toDate?: () => Date };
}

export interface RedeemResult {
  milouAmount: number;
  premiumDays: number;
  reputationBonus: number;
  newBalance: number;
}

export async function redeemPromoCode(
  db: Firestore,
  uid: string,
  rawCode: string
): Promise<RedeemResult> {
  const codeId = normalizePromoCode(rawCode);
  if (!codeId || codeId.length < 3) {
    throw new Error('Code invalide');
  }

  const userRef = db.collection('users').doc(uid);
  const codeRef = db.collection('promo_codes').doc(codeId);
  const redemptionRef = codeRef.collection('redemptions').doc(uid);

  let result: RedeemResult = { milouAmount: 0, premiumDays: 0, reputationBonus: 0, newBalance: 0 };

  await db.runTransaction(async (tx) => {
    const [userSnap, codeSnap, redemptionSnap] = await Promise.all([
      tx.get(userRef),
      tx.get(codeRef),
      tx.get(redemptionRef),
    ]);

    if (!userSnap.exists) throw new Error('Utilisateur introuvable');
    if (!codeSnap.exists) throw new Error('Code inconnu ou expiré');

    const code = codeSnap.data() as PromoCodeData;
    if (!code.active) throw new Error('Ce code n\'est plus actif');

    if (code.expiresAt) {
      const exp = code.expiresAt.toDate?.() ?? new Date(String(code.expiresAt));
      if (exp.getTime() < Date.now()) throw new Error('Ce code a expiré');
    }

    const maxUses = Number(code.maxUses || 0);
    const usedCount = Number(code.usedCount || 0);
    if (maxUses > 0 && usedCount >= maxUses) {
      throw new Error('Ce code a atteint le nombre d\'utilisations maximum');
    }

    const maxPerUser = Math.max(1, Number(code.maxUsesPerUser || 1));
    const userUses = Number(redemptionSnap.data()?.count || 0);
    if (redemptionSnap.exists && userUses >= maxPerUser) {
      throw new Error('Vous avez déjà utilisé ce code');
    }

    const minAgeDays = Number(code.minAccountAgeDays || 0);
    if (minAgeDays > 0) {
      const created = userSnap.data()?.createdAt?.toDate?.();
      if (created) {
        const ageMs = Date.now() - created.getTime();
        if (ageMs < minAgeDays * 86400000) {
          throw new Error(`Compte trop récent (minimum ${minAgeDays} jours)`);
        }
      }
    }

    const milouAmount = Math.max(0, Number(code.milouAmount || 0));
    const premiumDays = Math.max(0, Number(code.premiumDays || 0));
    const reputationBonus = Math.max(0, Number(code.reputationBonus || 0));

    if (milouAmount === 0 && premiumDays === 0 && reputationBonus === 0) {
      throw new Error('Ce code ne contient aucune récompense');
    }

    if (reputationBonus > 0) {
      tx.update(userRef, { reputation: FieldValue.increment(reputationBonus) });
    }

    tx.update(codeRef, { usedCount: FieldValue.increment(1) });
    tx.set(
      redemptionRef,
      {
        userId: uid,
        count: userUses + 1,
        milouAmount,
        premiumDays,
        reputationBonus,
        redeemedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    result = {
      milouAmount,
      premiumDays,
      reputationBonus,
      newBalance: Number(userSnap.data()?.balance || 0),
    };
  });

  if (result.milouAmount > 0) {
    await transferMilou(db, {
      fromUserId: null,
      toUserId: uid,
      amount: result.milouAmount,
      type: 'promo_code',
      description: `Code promo : ${codeId}`,
    });
  }

  if (result.premiumDays > 0) {
    await grantPremiumByDays(db, uid, result.premiumDays);
  }

  const parts: string[] = [];
  if (result.milouAmount) parts.push(`${result.milouAmount} M`);
  if (result.premiumDays) parts.push(`${result.premiumDays} j Premium`);
  if (result.reputationBonus) parts.push(`+${result.reputationBonus} réputation`);

  await createNotification(db, {
    userId: uid,
    type: 'system',
    title: 'Code promo utilisé',
    body: `Récompense : ${parts.join(', ')}`,
    link: '/codes',
  });

  const userSnap = await db.collection('users').doc(uid).get();
  result.newBalance = Number(userSnap.data()?.balance || result.newBalance);

  return result;
}
