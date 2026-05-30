import { IconStar } from '@/components/ui/Icons';

export default function PremiumBadge({ size = 'sm' }: { size?: 'sm' | 'md' }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-lg font-medium bg-amber-500/10 text-amber-300 border border-amber-500/25 ${
        size === 'md' ? 'px-2.5 py-1 text-sm' : 'px-2 py-0.5 text-xs'
      }`}
    >
      <IconStar className={size === 'md' ? 'w-3.5 h-3.5' : 'w-3 h-3'} />
      Premium
    </span>
  );
}
