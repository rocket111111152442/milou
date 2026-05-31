'use client';

import { useState } from 'react';
import { listingsApi } from '@/lib/api';

const REASONS = [
  'Contenu inapproprié',
  'Arnaque ou fraude',
  'Hors sujet / spam',
  'Prix abusif',
  'Autre',
];

export default function ReportListingButton({ listingId }: { listingId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState(REASONS[0]);
  const [details, setDetails] = useState('');
  const [msg, setMsg] = useState('');

  if (!open) {
    return (
      <button type="button" className="text-xs text-zinc-500 hover:text-red-400" onClick={() => setOpen(true)}>
        Signaler
      </button>
    );
  }

  return (
    <div className="mt-2 p-2 rounded-lg border border-white/[0.06] bg-milou-bg text-xs space-y-2">
      <select className="input text-xs" value={reason} onChange={(e) => setReason(e.target.value)}>
        {REASONS.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>
      <input
        className="input text-xs"
        placeholder="Détails (optionnel)"
        value={details}
        onChange={(e) => setDetails(e.target.value)}
      />
      <div className="flex gap-2">
        <button
          type="button"
          className="btn-primary text-xs py-1"
          onClick={async () => {
            try {
              await listingsApi.report(listingId, { reason, details });
              setMsg('Signalement envoyé. Merci.');
              setTimeout(() => setOpen(false), 1500);
            } catch (err) {
              setMsg(err instanceof Error ? err.message : 'Erreur');
            }
          }}
        >
          Envoyer
        </button>
        <button type="button" className="btn-secondary text-xs py-1" onClick={() => setOpen(false)}>
          Annuler
        </button>
      </div>
      {msg && <p className="text-cyan-400">{msg}</p>}
    </div>
  );
}
