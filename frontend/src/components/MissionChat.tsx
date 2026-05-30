'use client';

import { useEffect, useRef, useState } from 'react';
import { MissionMessage } from '@/lib/types';
import { chatApi } from '@/lib/api';

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
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

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
  }, [messages, open]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    setSending(true);
    try {
      const { message } = await chatApi.send(missionId, trimmed);
      setMessages((prev) => [...prev, message]);
      setText('');
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Envoi impossible');
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
          {messages.map((m) => {
            const isMe = m.senderId === currentUserId;
            const isSystem = m.senderId === 'system';
            return (
              <div
                key={m._id}
                className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
              >
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
                  <p className="whitespace-pre-wrap break-words">{m.text}</p>
                  {!isSystem && (
                    <p className="text-[10px] text-gray-500 mt-1 text-right">
                      {m.createdAt
                        ? new Date(m.createdAt).toLocaleTimeString('fr-FR', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : ''}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {error && <p className="px-4 text-milou-danger text-xs">{error}</p>}

        <form onSubmit={handleSend} className="p-3 border-t border-milou-border flex gap-2 bg-milou-card">
          <input
            className="input flex-1 text-sm"
            placeholder="Écrire un message…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={2000}
            disabled={sending}
          />
          <button type="submit" className="btn-primary px-4 shrink-0" disabled={sending || !text.trim()}>
            {sending ? '…' : 'Envoyer'}
          </button>
        </form>
      </div>
    </div>
  );
}
