'use client';

import { useEffect, useRef, useState } from 'react';
import { MissionMessage } from '@/lib/types';
import { chatApi } from '@/lib/api';
import ChatMessageContent from '@/components/ChatMessageContent';

interface Props {
  missionId: string;
  missionTitle: string;
  currentUserId: string;
  otherPartyName: string;
  open: boolean;
  onClose: () => void;
  onMarkedRead?: () => void;
}

export default function MissionChat({
  missionId,
  missionTitle,
  currentUserId,
  otherPartyName,
  open,
  onClose,
  onMarkedRead,
}: Props) {
  const [messages, setMessages] = useState<MissionMessage[]>([]);
  const [text, setText] = useState('');
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const markRead = async () => {
    try {
      await chatApi.markRead(missionId);
      onMarkedRead?.();
    } catch {
      /* ignore */
    }
  };

  const load = async () => {
    try {
      const { messages: list } = await chatApi.list(missionId);
      setMessages(list);
      setError('');
      if (open) await markRead();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur chargement');
    }
  };

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    markRead().then(() => load()).finally(() => setLoading(false));
    const interval = setInterval(load, 3000);
    return () => clearInterval(interval);
  }, [open, missionId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open, pendingFiles]);

  function addFiles(list: FileList | null) {
    if (!list?.length) return;
    setPendingFiles((prev) => {
      const map = new Map(prev.map((f) => [`${f.name}-${f.size}`, f]));
      Array.from(list).forEach((f) => map.set(`${f.name}-${f.size}`, f));
      return Array.from(map.values()).slice(0, 10);
    });
  }

  async function handleDeleteMessage(messageId: string) {
    if (!window.confirm('Supprimer ce message ?')) return;
    try {
      await chatApi.deleteMessage(missionId, messageId);
      setMessages((prev) => prev.filter((m) => m._id !== messageId));
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Suppression impossible');
    }
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed && pendingFiles.length === 0) return;
    setSending(true);
    setError('');
    try {
      let message: MissionMessage;
      if (pendingFiles.length > 0) {
        const res = await chatApi.sendFiles(missionId, trimmed, pendingFiles);
        message = res.message;
        setPendingFiles([]);
      } else {
        const res = await chatApi.send(missionId, trimmed);
        message = res.message;
      }
      setMessages((prev) => [...prev, message]);
      setText('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Envoi impossible');
    } finally {
      setSending(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/70"
        aria-label="Fermer"
        onClick={onClose}
      />
      <div className="relative w-full sm:max-w-lg h-[85vh] sm:h-[32rem] flex flex-col bg-milou-card border border-milou-border rounded-t-2xl sm:rounded-2xl shadow-neon-strong overflow-hidden">
        <header className="flex items-center justify-between px-4 py-3 border-b border-milou-border bg-milou-bg/80">
          <div>
            <p className="text-xs text-cyan-400 uppercase tracking-wide">Discussion mission</p>
            <h2 className="font-semibold text-white truncate max-w-[240px] sm:max-w-xs">{missionTitle}</h2>
            <p className="text-xs text-gray-500">Avec {otherPartyName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl leading-none px-2"
          >
            ×
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-milou-bg/50">
          {loading && messages.length === 0 && (
            <p className="text-center text-gray-500 text-sm">Chargement des messages…</p>
          )}
          <p className="text-center text-[10px] text-gray-600 pb-1">
            Images, PDF, ZIP, dossiers (max 15 Mo/fichier, 10 fichiers)
          </p>
          {messages.map((m) => {
            const isMe = m.senderId === currentUserId;
            const isSystem = m.senderId === 'system';
            return (
              <div key={m._id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                    isSystem
                      ? 'bg-violet-500/10 text-violet-300 text-center w-full max-w-full'
                      : isMe
                        ? 'bg-cyan-600/30 text-cyan-50 rounded-br-md'
                        : 'bg-milou-card border border-milou-border text-gray-100 rounded-bl-md'
                  }`}
                >
                  {!isSystem && !isMe && (
                    <p className="text-xs text-gray-500 mb-0.5">{m.senderName}</p>
                  )}
                  <ChatMessageContent text={m.text} attachments={m.attachments} />
                  {!isSystem && (
                    <div className="flex items-center justify-end gap-2 mt-1">
                      <p className="text-[10px] text-gray-500">
                        {m.createdAt
                          ? new Date(m.createdAt).toLocaleTimeString('fr-FR', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : ''}
                      </p>
                      {isMe && (
                        <button
                          type="button"
                          className="text-[10px] text-red-400/80 hover:text-red-300"
                          onClick={() => handleDeleteMessage(m._id)}
                        >
                          Supprimer
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {pendingFiles.length > 0 && (
          <div className="px-3 py-2 border-t border-milou-border/50 bg-milou-bg/80 max-h-24 overflow-y-auto">
            <p className="text-xs text-gray-500 mb-1">Fichiers à envoyer ({pendingFiles.length})</p>
            <ul className="flex flex-wrap gap-1">
              {pendingFiles.map((f) => (
                <li
                  key={`${f.name}-${f.size}`}
                  className="text-xs bg-cyan-500/10 text-cyan-300 px-2 py-0.5 rounded-full flex items-center gap-1"
                >
                  <span className="truncate max-w-[120px]">{f.name}</span>
                  <button
                    type="button"
                    className="text-red-400"
                    onClick={() =>
                      setPendingFiles((prev) =>
                        prev.filter((x) => x.name !== f.name || x.size !== f.size)
                      )
                    }
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {error && <p className="px-4 text-milou-danger text-xs">{error}</p>}

        <form
          onSubmit={handleSend}
          className="p-3 border-t border-milou-border bg-milou-card space-y-2"
        >
          <div className="flex gap-1">
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              multiple
              accept="image/*,.pdf,.zip,.rar,.7z,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
              onChange={(e) => {
                addFiles(e.target.files);
                e.target.value = '';
              }}
            />
            <input
              ref={folderInputRef}
              type="file"
              className="hidden"
              multiple
              // @ts-expect-error webkitdirectory non standard
              webkitdirectory=""
              onChange={(e) => {
                addFiles(e.target.files);
                e.target.value = '';
              }}
            />
            <button
              type="button"
              className="btn-secondary text-xs px-2 py-1.5"
              onClick={() => fileInputRef.current?.click()}
              disabled={sending}
              title="Images, PDF, documents"
            >
              📎 Fichiers
            </button>
            <button
              type="button"
              className="btn-secondary text-xs px-2 py-1.5"
              onClick={() => folderInputRef.current?.click()}
              disabled={sending}
              title="Envoyer un dossier entier"
            >
              📁 Dossier
            </button>
          </div>
          <div className="flex gap-2">
            <input
              className="input flex-1 text-sm"
              placeholder="Message ou légende…"
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={2000}
              disabled={sending}
            />
            <button
              type="submit"
              className="btn-primary px-4 shrink-0"
              disabled={sending || (!text.trim() && pendingFiles.length === 0)}
            >
              {sending ? '…' : 'Envoyer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
