'use client';

import { useState } from 'react';

export default function AcceptListingModal({
  open,
  listingTitle,
  onClose,
  onConfirm,
}: {
  open: boolean;
  listingTitle: string;
  onClose: () => void;
  onConfirm: (message: string) => Promise<void>;
}) {
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div className="card max-w-md w-full">
        <h2 className="text-lg font-semibold text-white mb-1">Accepter la mission</h2>
        <p className="text-sm text-zinc-400 mb-4">{listingTitle}</p>
        <label className="label">Message au client (optionnel)</label>
        <textarea
          className="input min-h-[80px] mb-4"
          placeholder="Présentez-vous, précisez vos disponibilités…"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={500}
        />
        <div className="flex gap-2 justify-end">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={loading}>
            Annuler
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={loading}
            onClick={async () => {
              setLoading(true);
              try {
                await onConfirm(message.trim());
                setMessage('');
                onClose();
              } finally {
                setLoading(false);
              }
            }}
          >
            {loading ? 'Démarrage…' : 'Démarrer la mission'}
          </button>
        </div>
      </div>
    </div>
  );
}
