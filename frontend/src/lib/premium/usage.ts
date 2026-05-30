import { Firestore, Timestamp } from 'firebase-admin/firestore';
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

export async function getUserUsage(db: Firestore, uid: string, userData: Record<string, unknown>) {
  const limits = getLimitsForUser(userData);
  const monthStart = Timestamp.fromDate(startOfMonth());
  const dayStart = Timestamp.fromDate(startOfDay());

  const activeStatuses = ['pending', 'in_progress', 'escrow_held'];

  const [listingsSnap, transfersSnap, clientMissions, providerMissions] = await Promise.all([
    db.collection('listings').where('userId', '==', uid).where('createdAt', '>=', monthStart).get(),
    db
      .collection('transactions')
      .where('fromUserId', '==', uid)
      .where('type', '==', 'transfer')
      .where('createdAt', '>=', dayStart)
      .get(),
    db.collection('missions').where('clientId', '==', uid).get(),
    db.collection('missions').where('providerId', '==', uid).get(),
  ]);

  const missionIds = new Set<string>();
  [...clientMissions.docs, ...providerMissions.docs].forEach((d) => {
    if (activeStatuses.includes(String(d.data().status))) missionIds.add(d.id);
  });
  const activeMissions = missionIds.size;

  return {
    isPremium: isPremiumActive(userData),
    limits,
    usage: {
      listingsThisMonth: listingsSnap.size,
      transfersToday: transfersSnap.size,
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
