import { IconStar } from '@/components/ui/Icons';

const SIZES = {
  xs: 'w-3 h-3',
  sm: 'w-3.5 h-3.5',
  md: 'w-4 h-4',
  lg: 'w-6 h-6',
} as const;

interface Props {
  /** Note de 0 à 5 (décimales acceptées pour les moyennes) */
  value: number;
  size?: keyof typeof SIZES;
  className?: string;
}

/** Affichage en lecture seule. Gère les demi-étoiles pour les moyennes. */
export default function StarRating({ value, size = 'sm', className = '' }: Props) {
  const v = Math.max(0, Math.min(5, value));
  return (
    <span
      className={`inline-flex items-center gap-0.5 ${className}`}
      role="img"
      aria-label={`${Math.round(v * 10) / 10} sur 5`}
    >
      {[1, 2, 3, 4, 5].map((n) => {
        const fill = Math.max(0, Math.min(1, v - (n - 1)));
        return (
          <span key={n} className={`relative inline-block ${SIZES[size]}`}>
            <IconStar className={`absolute inset-0 ${SIZES[size]} text-zinc-700`} />
            {fill > 0 && (
              <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
                <IconStar className={`${SIZES[size]} text-amber-400 drop-shadow-[0_0_6px_rgba(251,191,36,0.35)]`} />
              </span>
            )}
          </span>
        );
      })}
    </span>
  );
}
