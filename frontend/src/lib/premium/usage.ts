import { Firestore } from 'firebase-admin/firestore';
import { getLimitsForUser, isPremiumActive } from './index';

function startOfDay() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfMonth() {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Évite les index composites Firestore : filtre createdAt côté serveur. */
function timestampMs(value: unknown): number {
  if (!value) return 0;
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    const d = (value as { toDate?: () => Date }).toDate?.();
    return d ? d.getTime() : 0;
  }
  return new Date(String(value)).getTime();
}

export async function getUserUsage(db: Firestore, uid: string, userData: Record<string, unknown>) {
  const limits = getLimitsForUser(userData);
  const monthStartMs = startOfMonth().getTime();
  const dayStartMs = startOfDay().getTime();

  const activeStatuses = ['pending', 'in_progress', 'escrow_held', 'disputed'];

  const [listingsSnap, transfersSnap, clientMissions, providerMissions] = await Promise.all([
    db.collection('listings').where('userId', '==', uid).limit(200).get(),
    db.collection('transactions').where('fromUserId', '==', uid).limit(300).get(),
    db.collection('missions').where('clientId', '==', uid).get(),
    db.collection('missions').where('providerId', '==', uid).get(),
  ]);

  const listingsThisMonth = listingsSnap.docs.filter(
    (d) => timestampMs(d.data().createdAt) >= monthStartMs
  ).length;

  const transfersToday = transfersSnap.docs.filter((d) => {
    const data = d.data();
    return data.type === 'transfer' && timestampMs(data.createdAt) >= dayStartMs;
  }).length;

  const missionIds = new Set<string>();
  [...clientMissions.docs, ...providerMissions.docs].forEach((d) => {
    if (activeStatuses.includes(String(d.data().status))) missionIds.add(d.id);
  });
  const activeMissions = missionIds.size;

  return {
    isPremium: isPremiumActive(userData),
    limits,
    usage: {
      listingsThisMonth,
      transfersToday,
      activeMissions,
    },
  };
}

export async function assertCanCreateListing(db: Firestore, uid: string, userData: Record<string, unknown>) {
  const { limits, usage } = await getUserUsage(db, uid, userData);
  if (usage.listingsThisMonth >= limits.maxListingsPerMonth) {
    throw new Error(
      `Limite atteinte : ${limits.maxListingsPerMonth} annonces/mois. Passez Premium MILOU pour en publier plus.`
    );
  }
}

export async function assertCanAcceptMission(db: Firestore, uid: string, userData: Record<string, unknown>) {
  const { limits, usage } = await getUserUsage(db, uid, userData);
  if (usage.activeMissions >= limits.maxActiveMissions) {
    throw new Error(
      `Limite de ${limits.maxActiveMissions} missions actives. Terminez-en une ou passez Premium.`
    );
  }
}

export async function assertCanTransfer(
  db: Firestore,
  uid: string,
  userData: Record<string, unknown>,
  amount: number
) {
  const { limits, usage } = await getUserUsage(db, uid, userData);
  if (usage.transfersToday >= limits.maxTransfersPerDay) {
    throw new Error('Limite de transferts quotidiens atteinte. Passez Premium pour continuer.');
  }
  if (amount > limits.maxTransferAmount) {
    throw new Error(`Montant max : ${limits.maxTransferAmount} M (compte gratuit). Premium : jusqu'à 500 M.`);
  }
}
