import type { Firestore } from 'firebase-admin/firestore';

export async function countUnreadMessages(
  db: Firestore,
  missionId: string,
  uid: string
): Promise<number> {
  const readSnap = await db
    .collection('missions')
    .doc(missionId)
    .collection('readReceipts')
    .doc(uid)
    .get();

  const lastRead = readSnap.exists
    ? readSnap.data()?.lastReadAt?.toDate?.() || new Date(0)
    : new Date(0);

  const msgsSnap = await db
    .collection('missions')
    .doc(missionId)
    .collection('messages')
    .orderBy('createdAt', 'asc')
    .get();

  let count = 0;
  for (const d of msgsSnap.docs) {
    const data = d.data();
    if (data.senderId === uid || data.senderId === 'system') continue;
    const created = data.createdAt?.toDate?.() || new Date(0);
    if (created > lastRead) count++;
  }
  return count;
}
