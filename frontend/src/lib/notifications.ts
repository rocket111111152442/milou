import { FieldValue, Firestore } from 'firebase-admin/firestore';

export type NotificationType =
  | 'transfer_received'
  | 'transfer_sent'
  | 'mission_started'
  | 'mission_completed'
  | 'message'
  | 'premium_activated'
  | 'review_received'
  | 'system';

export async function createNotification(
  db: Firestore,
  data: {
    userId: string;
    type: NotificationType;
    title: string;
    body: string;
    link?: string;
  }
) {
  await db.collection('notifications').add({
    userId: data.userId,
    type: data.type,
    title: data.title,
    body: data.body,
    link: data.link || '',
    read: false,
    createdAt: FieldValue.serverTimestamp(),
  });
}
