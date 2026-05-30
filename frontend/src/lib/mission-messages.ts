import { tsToIso } from '@/lib/firebase/wallet';
import type { MissionMessage, ChatAttachment } from '@/lib/types';

export function mapMessageDoc(id: string, data: Record<string, unknown>): MissionMessage {
  const attachments = Array.isArray(data.attachments)
    ? (data.attachments as Record<string, unknown>[]).map((a) => ({
        name: String(a.name || ''),
        url: String(a.url || ''),
        mimeType: String(a.mimeType || ''),
        size: Number(a.size || 0),
        kind: (a.kind as ChatAttachment['kind']) || 'file',
      }))
    : undefined;

  return {
    _id: id,
    senderId: String(data.senderId || ''),
    senderName: String(data.senderName || ''),
    text: String(data.text || ''),
    attachments: attachments?.length ? attachments : undefined,
    createdAt: tsToIso(data.createdAt),
  };
}
