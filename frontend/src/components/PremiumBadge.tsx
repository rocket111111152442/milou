export default function PremiumBadge({ size = 'sm' }: { size?: 'sm' | 'md' }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-semibold bg-gradient-to-r from-amber-400/20 to-yellow-500/20 text-amber-300 border border-amber-400/40 ${
        size === 'md' ? 'px-3 py-1 text-sm' : 'px-2 py-0.5 text-xs'
      }`}
    >
      <span aria-hidden>⭐</span> Premium
    </span>
  );
}
