export type AttachmentKind = 'image' | 'pdf' | 'file' | 'archive';

export interface ChatAttachmentInput {
  name: string;
  mimeType: string;
  size: number;
  buffer: Buffer;
}

export interface ChatAttachmentMeta {
  name: string;
  url: string;
  mimeType: string;
  size: number;
  kind: AttachmentKind;
  storagePath: string;
}

const MAX_FILE_BYTES = 15 * 1024 * 1024;
const MAX_FILES = 10;
const MAX_TOTAL_BYTES = 50 * 1024 * 1024;

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/pdf',
  'application/zip',
  'application/x-zip-compressed',
  'application/vnd.rar',
  'application/x-rar-compressed',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
]);

const ALLOWED_EXT = new Set([
  'jpg',
  'jpeg',
  'png',
  'gif',
  'webp',
  'heic',
  'pdf',
  'zip',
  'rar',
  '7z',
  'txt',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'ppt',
  'pptx',
]);

export function getAttachmentKind(mimeType: string, name: string): AttachmentKind {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType === 'application/pdf' || name.toLowerCase().endsWith('.pdf')) return 'pdf';
  if (
    mimeType.includes('zip') ||
    mimeType.includes('rar') ||
    mimeType.includes('7z') ||
    /\.(zip|rar|7z)$/i.test(name)
  ) {
    return 'archive';
  }
  return 'file';
}

export function sanitizeFileName(name: string): string {
  const base = String(name || 'fichier')
    .replace(/[/\\]/g, '_')
    .replace(/[^\w.\-àâäéèêëïîôùûüçÀÂÄÉÈÊËÏÎÔÙÛÜÇ ]/gi, '_')
    .slice(0, 120);
  return base || 'fichier';
}

export function validateChatFile(file: { name: string; type: string; size: number }): void {
  if (file.size > MAX_FILE_BYTES) {
    throw new Error(`Fichier trop volumineux (max ${MAX_FILE_BYTES / 1024 / 1024} Mo) : ${file.name}`);
  }
  const baseName = file.name.split(/[/\\]/).pop() || file.name;
  const ext = baseName.split('.').pop()?.toLowerCase() || '';
  const mime = file.type || 'application/octet-stream';
  if (!ALLOWED_MIME.has(mime) && !ALLOWED_EXT.has(ext)) {
    throw new Error(`Type de fichier non autorisé : ${file.name}`);
  }
}

export function validateChatFileBatch(
  files: { name: string; type: string; size: number }[]
): void {
  if (files.length > MAX_FILES) {
    throw new Error(`Maximum ${MAX_FILES} fichiers par envoi`);
  }
  let total = 0;
  for (const f of files) {
    validateChatFile(f);
    total += f.size;
  }
  if (total > MAX_TOTAL_BYTES) {
    throw new Error('Taille totale des fichiers trop importante (max 50 Mo)');
  }
}

export { MAX_FILES, MAX_FILE_BYTES };
