'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { IconArrowRight } from '@/components/ui/Icons';
import { MILOU_EXAMPLES, SIGNUP_BONUS_MILOU, examplesTotalMilou } from '@/lib/landing-examples';

export default function LandingMilouExamples({ compact }: { compact?: boolean }) {
  const [visible, setVisible] = useState(0);

  useEffect(() => {
    const timers = MILOU_EXAMPLES.map((_, i) =>
      setTimeout(() => setVisible(i + 1), 180 + i * 220)
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div className={compact ? 'space-y-3' : 'space-y-4'}>
      <div className={`grid gap-3 ${compact ? 'grid-cols-1' : 'sm:grid-cols-3'}`}>
        {MILOU_EXAMPLES.map((ex, i) => (
          <div
            key={ex.service}
            className={`relative overflow-hidden rounded-2xl border bg-gradient-to-br ${ex.accent} ${ex.border}
              transition-all duration-500 ease-out
              ${visible > i ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-6 scale-[0.97]'}
              ${!compact ? 'hover:scale-[1.02] hover:shadow-card-hover' : ''}`}
            style={{ transitionDelay: `${i * 80}ms` }}
          >
            <div className={`p-4 ${compact ? 'sm:p-4' : 'sm:p-5'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-medium mb-1">
                    {ex.category}
                  </p>
                  <p className={`font-semibold text-white leading-snug ${compact ? 'text-sm' : 'text-base sm:text-lg'}`}>
                    {ex.service}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className={`font-black tabular-nums leading-none ${ex.priceColor} ${compact ? 'text-3xl' : 'text-4xl sm:text-5xl'}`}>
                    {ex.price}
                  </p>
                  <p className="text-xs font-bold text-zinc-500 mt-0.5">Milou</p>
                </div>
              </div>
            </div>
            <div className="px-4 pb-3 sm:px-5">
              <p className="text-[11px] text-zinc-500">
                <span className={ex.priceColor}>{ex.price} M</span>
                {' = '}
                {ex.service.toLowerCase()}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div
        className={`rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 sm:px-5 sm:py-4
          transition-all duration-700 ${visible >= MILOU_EXAMPLES.length ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <p className="text-sm sm:text-base text-zinc-200 leading-relaxed">
            <strong className="text-emerald-400">{SIGNUP_BONUS_MILOU} Milou offerts</strong> à l&apos;inscription
            {' — '}assez pour un logo, un montage et un bot Discord.
            <span className="text-zinc-500"> Il vous reste même {SIGNUP_BONUS_MILOU - examplesTotalMilou} M.</span>
          </p>
          <Link
            href="/register"
            className="btn-primary shrink-0 text-sm py-2.5 px-5 w-full sm:w-auto justify-center"
          >
            Créer mon compte
            <IconArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
