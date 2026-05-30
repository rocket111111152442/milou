'use client';

import { ChatAttachment } from '@/lib/types';

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / 1024 / 1024).toFixed(1)} Mo`;
}

export default function ChatMessageContent({
  text,
  attachments,
}: {
  text: string;
  attachments?: ChatAttachment[];
}) {
  const hasFiles = attachments && attachments.length > 0;
  const isOnlyFileLabel =
    hasFiles && attachments!.length === 1 && text === `📎 ${attachments![0].name}`;
  const isOnlyMultiLabel =
    hasFiles && attachments!.length > 1 && text === `📎 ${attachments!.length} fichiers`;

  return (
    <div className="space-y-2">
      {text && !isOnlyFileLabel && !isOnlyMultiLabel && (
        <p className="whitespace-pre-wrap break-words">{text}</p>
      )}
      {hasFiles && (
        <div className="space-y-2">
          {attachments!.map((a, i) => (
            <div key={`${a.url}-${i}`} className="rounded-lg overflow-hidden border border-white/10">
              {a.kind === 'image' ? (
                <a href={a.url} target="_blank" rel="noopener noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={a.url}
                    alt={a.name}
                    className="max-w-full max-h-48 object-contain bg-black/20"
                  />
                </a>
              ) : (
                <a
                  href={a.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 p-2.5 bg-black/20 hover:bg-black/30 transition text-sm"
                >
                  <span className="text-lg">
                    {a.kind === 'pdf' ? '📄' : a.kind === 'archive' ? '📁' : '📎'}
                  </span>
                  <span className="flex-1 min-w-0 truncate">{a.name}</span>
                  <span className="text-xs text-gray-500 shrink-0">{formatSize(a.size)}</span>
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
