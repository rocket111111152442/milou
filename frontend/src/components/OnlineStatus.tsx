'use client';

import { useEffect, useState } from 'react';
import { presenceApi } from '@/lib/api';

export default function OnlineStatus({ userId }: { userId: string }) {
  const [online, setOnline] = useState(false);

  useEffect(() => {
    presenceApi.get(userId).then((r) => setOnline(r.isOnline)).catch(() => {});
  }, [userId]);

  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-gray-500">
      <span className={`w-2 h-2 rounded-full ${online ? 'bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.8)]' : 'bg-gray-600'}`} />
      {online ? 'En ligne' : 'Hors ligne'}
    </span>
  );
}
