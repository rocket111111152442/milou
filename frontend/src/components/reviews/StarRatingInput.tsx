'use client';

import { useState } from 'react';
import { IconStar } from '@/components/ui/Icons';
import { RATING_LABELS } from '@/lib/review-constants';

interface Props {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}

/** Sélecteur d'étoiles accessible (radiogroup + flèches clavier) avec aperçu au survol. */
export default function StarRatingInput({ value, onChange, disabled }: Props) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;

  function onKeyDown(e: React.KeyboardEvent) {
    if (disabled) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      onChange(Math.min(5, (value || 0) + 1));
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      onChange(Math.max(1, (value || 2) - 1));
    }
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        role="radiogroup"
        aria-label="Note de la mission"
        className="flex items-center gap-1.5"
        onMouseLeave={() => setHover(0)}
        onKeyDown={onKeyDown}
      >
        {[1, 2, 3, 4, 5].map((n) => {
          const active = n <= shown;
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={value === n}
              aria-label={`${n} étoile${n > 1 ? 's' : ''} — ${RATING_LABELS[n]}`}
              tabIndex={value === n || (!value && n === 1) ? 0 : -1}
              disabled={disabled}
              onMouseEnter={() => setHover(n)}
              onFocus={() => setHover(0)}
              onClick={() => onChange(n)}
              className="p-1 rounded-lg transition-transform duration-150 hover:scale-110 active:scale-95
                         focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50
                         disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              <IconStar
                className={`w-8 h-8 transition-colors duration-150 ${
                  active
                    ? 'text-amber-400 drop-shadow-[0_0_10px_rgba(251,191,36,0.45)]'
                    : 'text-zinc-700 hover:text-zinc-600'
                }`}
              />
            </button>
          );
        })}
      </div>
      <p
        className={`text-sm font-medium h-5 transition-colors ${shown ? 'text-amber-300' : 'text-zinc-500'}`}
        aria-live="polite"
      >
        {shown ? RATING_LABELS[shown] : 'Touchez une étoile pour noter'}
      </p>
    </div>
  );
}
