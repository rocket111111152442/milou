'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { IconArrowRight } from '@/components/ui/Icons';
import {
  LANDING_SOCIAL_PROOF,
  MILOU_EXAMPLES,
  SIGNUP_BONUS_MILOU,
} from '@/lib/landing-examples';

function SocialProofLines({ className = '' }: { className?: string }) {
  return (
    <p className={`text-xs text-zinc-500 leading-relaxed ${className}`}>
      {LANDING_SOCIAL_PROOF.movement}
      <span className="block text-zinc-600 mt-1">{LANDING_SOCIAL_PROOF.visitors}</span>
    </p>
  );
}

export default function LandingMilouExamples({ compact }: { compact?: boolean }) {
  const [visible, setVisible] = useState(0);

  useEffect(() => {
    const timers = MILOU_EXAMPLES.map((_, i) =>
      setTimeout(() => setVisible(i + 1), 150 + i * 160)
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div className={compact ? 'space-y-3' : 'space-y-4'}>
      {!compact && (
        <p className="text-center text-xs text-zinc-500 max-w-xl mx-auto">
          Exemples de micro-services rapides sur le marketplace —{' '}
          <span className="text-zinc-400">chaque membre fixe son propre prix.</span>
        </p>
      )}

      <div
        className={`grid gap-3 ${
          compact
            ? 'grid-cols-1 sm:grid-cols-2'
            : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5'
        }`}
      >
        {MILOU_EXAMPLES.map((ex, i) => (
          <div
            key={ex.service}
            className={`relative overflow-hidden rounded-2xl border bg-gradient-to-br ${ex.accent} ${ex.border}
              transition-all duration-500 ease-out
              ${visible > i ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-6 scale-[0.97]'}
              ${!compact ? 'hover:scale-[1.02] hover:shadow-card-hover' : ''}`}
            style={{ transitionDelay: `${i * 60}ms` }}
          >
            <div className={`p-4 ${compact ? '' : 'sm:p-4'}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-medium mb-1">
                    {ex.category}
                  </p>
                  <p
                    className={`font-semibold text-white leading-snug ${
                      compact ? 'text-sm' : 'text-sm sm:text-base'
                    }`}
                  >
                    {ex.service}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p
                    className={`font-black tabular-nums leading-none ${ex.priceColor} ${
                      compact ? 'text-2xl' : 'text-3xl sm:text-4xl'
                    }`}
                  >
                    {ex.price}
                  </p>
                  <p className="text-[10px] font-bold text-zinc-500 mt-0.5">Milou</p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div
        className={`rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 sm:px-5 sm:py-4
          transition-all duration-700 ${visible >= MILOU_EXAMPLES.length ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="space-y-2">
            <p className="text-sm sm:text-base text-zinc-200 leading-relaxed">
              <strong className="text-emerald-400">{SIGNUP_BONUS_MILOU} Milou offerts</strong> à
              l&apos;inscription — de quoi tester le marketplace et commander plusieurs petits
              services.
            </p>
            <p className="text-xs text-zinc-500">
              Pas une promesse de prestations incluses : ce sont des annonces réelles, publiées par
              la communauté.
            </p>
          </div>
          <div className="flex flex-col gap-2 shrink-0 w-full sm:w-auto">
            <Link
              href="/register"
              className="btn-primary text-sm py-2.5 px-5 w-full sm:w-auto justify-center"
            >
              Créer mon compte
              <IconArrowRight className="w-4 h-4" />
            </Link>
            <SocialProofLines className="text-center sm:text-right" />
          </div>
        </div>
      </div>
    </div>
  );
}

export { SocialProofLines };
