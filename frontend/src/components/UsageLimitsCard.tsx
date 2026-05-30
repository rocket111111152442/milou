'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { premiumApi } from '@/lib/api';
import type { PremiumUsage } from '@/lib/types';

export default function UsageLimitsCard({ isPremium }: { isPremium?: boolean }) {
  const [usage, setUsage] = useState<PremiumUsage | null>(null);

  useEffect(() => {
    premiumApi.usage().then(setUsage).catch(() => {});
  }, []);

  if (!usage) return null;

  const bars = [
    { label: 'Annonces / mois', u: usage.usage.listingsThisMonth, m: usage.limits.maxListingsPerMonth },
    { label: 'Transferts / jour', u: usage.usage.transfersToday, m: usage.limits.maxTransfersPerDay },
    { label: 'Missions actives', u: usage.usage.activeMissions, m: usage.limits.maxActiveMissions },
  ];

  return (
    <div className="card">
      <div className="flex justify-between items-start mb-4">
        <h3 className="font-semibold text-white">Vos limites</h3>
        {!isPremium && (
          <Link href="/premium" className="text-xs text-amber-400 hover:underline">
            Passer Premium →
          </Link>
        )}
      </div>
      <div className="space-y-3">
        {bars.map((b) => {
          const pct = Math.min(100, (b.u / b.m) * 100);
          return (
            <div key={b.label}>
              <div className="flex justify-between text-xs text-gray-400 mb-1">
                <span>{b.label}</span>
                <span>
                  {b.u}/{b.m >= 999 ? '∞' : b.m}
                </span>
              </div>
              <div className="h-2 rounded-full bg-milou-bg overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    pct > 85 ? 'bg-amber-500' : 'bg-cyan-500'
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
