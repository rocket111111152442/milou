import StarRating from './StarRating';

interface Props {
  average: number;
  count: number;
  /** Index = note (0 à 5) */
  distribution: number[];
}

export default function ReviewSummary({ average, count, distribution }: Props) {
  const analysed = distribution.reduce((a, b) => a + b, 0);
  const penalties = distribution[0] ?? 0;

  return (
    <div className="flex flex-col sm:flex-row gap-6 sm:items-center p-5 rounded-2xl bg-milou-surface/60 border border-white/[0.06]">
      <div className="flex flex-col items-center sm:items-start sm:pr-6 sm:border-r sm:border-white/[0.06] shrink-0">
        <p className="text-5xl font-bold text-white tabular-nums leading-none">
          {count > 0 ? average.toFixed(1) : '—'}
          <span className="text-lg font-medium text-zinc-500">/5</span>
        </p>
        <StarRating value={average} size="md" className="mt-3" />
        <p className="text-xs text-zinc-500 mt-2">
          {count} avis vérifié{count > 1 ? 's' : ''}
        </p>
      </div>

      <ul className="flex-1 space-y-1.5" aria-label="Répartition des notes">
        {[5, 4, 3, 2, 1].map((n) => {
          const c = distribution[n] ?? 0;
          const pct = analysed ? Math.round((c / analysed) * 100) : 0;
          return (
            <li key={n} className="flex items-center gap-3 text-xs">
              <span className="w-3 text-zinc-400 tabular-nums text-right">{n}</span>
              <div className="flex-1 h-2 rounded-full bg-white/[0.05] overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-300 transition-all duration-700"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="w-8 text-zinc-500 tabular-nums text-right">{c}</span>
            </li>
          );
        })}
        {penalties > 0 && (
          <li className="flex items-center gap-3 text-xs pt-1">
            <span className="w-3 text-red-400/80 tabular-nums text-right">0</span>
            <span className="flex-1 text-red-400/80">Pénalités délai dépassé</span>
            <span className="w-8 text-red-400/80 tabular-nums text-right">{penalties}</span>
          </li>
        )}
      </ul>
    </div>
  );
}
