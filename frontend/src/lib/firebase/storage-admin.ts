import { randomUUID } from 'crypto';
import { getStorage } from 'firebase-admin/storage';
import { getAdminApp } from '@/lib/firebase/admin';
import {
  ChatAttachmentInput,
  ChatAttachmentMeta,
  getAttachmentKind,
  sanitizeFileName,
} from '@/lib/chat-attachments';

export function getAdminBucket() {
  const bucketName =
    process.env.FIREBASE_STORAGE_BUCKET ||
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  return bucketName ? getStorage(getAdminApp()).bucket(bucketName) : getStorage(getAdminApp()).bucket();
}

export async function uploadChatAttachments(
  missionId: string,
  messageId: string,
  files: ChatAttachmentInput[]
): Promise<ChatAttachmentMeta[]> {
  const bucket = getAdminBucket();
  const results: ChatAttachmentMeta[] = [];

  for (const file of files) {
    const safeName = sanitizeFileName(file.name);
    const storagePath = `mission-chats/${missionId}/${messageId}/${randomUUID()}_${safeName}`;
    const token = randomUUID();
    const ref = bucket.file(storagePath);

    await ref.save(file.buffer, {
      metadata: {
        contentType: file.mimeType || 'application/octet-stream',
        metadata: {
          firebaseStorageDownloadTokens: token,
        },
      },
    });

    const encoded = encodeURIComponent(storagePath);
    const url = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encoded}?alt=media&token=${token}`;

    results.push({
      name: safeName,
      url,
      mimeType: file.mimeType || 'application/octet-stream',
      size: file.size,
      kind: getAttachmentKind(file.mimeType, safeName),
      storagePath,
    });
  }

  return results;
}

export async function deleteChatAttachments(paths: string[]) {
  const bucket = getAdminBucket();
  await Promise.all(
    paths.map(async (path) => {
      try {
        await bucket.file(path).delete({ ignoreNotFound: true });
      } catch {
        /* ignore */
      }
    })
  );
}
